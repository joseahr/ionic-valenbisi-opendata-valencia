import { Component, Injectable } from '@angular/core';
// Plugins Nativos
import { LocalNotifications, Geoposition, Diagnostic, Dialogs } from 'ionic-native';
// Componentes Angular 2
import { ModalController, NavController, Platform, LoadingController } from 'ionic-angular';
//import { Insomnia } from 'ionic-native';
// Interfaces
import { IVBCollection, INominatimResponse, IOSMRouteResponse } from '../../interfaces';
/* Servicios */
// ValenBisiService - Obtener paradas de valenbisi
import { EstacionesVBService } from '../../services/estaciones-valenbisi.service';
// ProjectionService - Obtener Proyecciones
import { ProjectionService } from '../../services/projection.service';
// StyleService - Estilos OpenLayers 3
import { StyleService } from '../../services/styles.service';
// LocationService - Obtener la posición | Escuchar cambios de localización
import { LocationService } from '../../services/location.service';
// GeocoderService - Obtener coordenadas a partir de nombres de calles
import { NominatimService } from '../../services/geocoder.service';
// RouteService - Obtener ruta a partir de coordenadas
import { OSMRouteService } from '../../services/routes.service';
// ModalPage - Página modal para mostrar detalles de una parada de valenbisi
import { ModalPage } from '../modal/modal';

// Declaramos la variable ol - OpenLayers 3
declare const ol: any;
// Declaramos la variable proj4 - Proj4.js
declare const proj4: any;

// Componente de Angular 2 - Página principal
@Injectable()
@Component({
  selector: 'page-page1',
  templateUrl: 'page1.html',
  providers : [ EstacionesVBService
              , ProjectionService
              , StyleService
              , LocationService
              , NominatimService
              , OSMRouteService
              ]
})
export class Page1 {
  // OpenLayers 3
  ol : any;
  // Mapa de OpenLayers 3
  map : any;
  // Esfera WGS84
  wgs84Sphere : any;
  // Parser de GeoJSON de OpenLayers 3
  geojsonParser : any;
  // Variable proj4 
  proj4 : any;
  //olGeolocation : any;
  //olLocationListener : any;

  // Capa de estaciones Valenbisi
  layerVB : any;
  // Source que almacena los cluster de estaciones ValenBisi
  clusterSource : any;
  // Capa de cluster de estaciones ValenBisi
  clusterLayer : any;
  // Lista de estaciones ValenBisi
  vbCollection : IVBCollection;

  // Almacenará los últimos estados de la estación seleccionada
  // cuando estemos yendo hacia ella
  selectedVBStates : any[] = [];

  // Estado que describe si se está navegando hacia una ruta o no
  navigating : Boolean = false;
  recalculatingRoute : Boolean = false;
  lastRecalculatingTime : Date;
  lastRecalculatingPosition : Array<any>;
  // Capa que almacena la ruta a la que se está yendo
  routeLayer : any;

  isGettingPosition : any = false;

  /* Parámetros de navegación */
  // Lista que almacena las últimas 20 posiciones
  positions : any;
  // Fecha de la última coordenada obtenida
  previousM : number = 0;
  // Marcador de Openlayers 3 - Overlay
  marker : any;
  // Marcador OL3 - Elemento HTML5
  markerEl : any;
  deltaMean : number = 500; // the geolocation sampling period mean in ms
  mapViewChange : any;

  watchCoordinates : any;

  constructor(
    public navCtrl: NavController, 
    public modalCtrl : ModalController,
    public loadingCtrl : LoadingController,
    public vbService : EstacionesVBService,
    public projService : ProjectionService, 
    public styleService : StyleService,
    public locationService : LocationService,
    public nominatimService : NominatimService,
    public routeService : OSMRouteService,
    public platform : Platform
  ) {}

  ngOnInit() : void {

    this.wgs84Sphere = new ol.Sphere(6378137);

    this.geojsonParser = new ol.format.GeoJSON();

    /*this.searchLayer = new ol.layer.Vector({
      source : new ol.source.Vector(),
      displayInLayerSwitcher : false
    });*/

    this.routeLayer = new ol.layer.Vector({
      source : new ol.source.Vector(),
      style  : this.styleService.getRouteStyle(),
      displayInLayerSwitcher : false
    });

    const lysw = new ol.control.LayerSwitcher({
      target : document.getElementById('lysw')
    });

    /*this.myLocationLayer = new ol.layer.Vector({
      source : new ol.source.Vector()
    });*/

    this.markerEl = document.getElementById('geolocation_marker');

    this.marker = new ol.Overlay({
      positioning: 'center-center',
      element: this.markerEl,
      stopEvent: false
    });

    // LineString to store the different geolocation positions. This LineString
    // is time aware.
    // The Z dimension is actually used to store the rotation (heading).
    this.positions = new ol.geom.LineString([],('XYZM'));

    this.clusterSource = new ol.source.Cluster({
      distance : 40,
      source : new ol.source.Vector()
    });

		this.clusterLayer = new ol.layer.AnimatedCluster({
      name: 'Paradas de ValenBisi',
			source: this.clusterSource,
			animationDuration: 700,
			style: this.styleService.getClusterStyle(),
		});

    // Capa WMS de los carriles bici y calles ciclables
    const carrilesBiciLayer = new ol.layer.Tile({
      name : 'Carriles Bici',
      source : new ol.source.TileWMS({
        url : 'http://mapas.valencia.es/lanzadera/opendata/Tra-carril-bici/wms',
        params : {
          "LAYERS" : 'TRA-CARRIL-BICI',
          gutter   : 200
        }
      })
    });

    // Grupo de capas que almacena las capas Base - OSM y Orto PNOA
    const baseLayers = new ol.layer.Group({
      name : 'Capas Base',
      layers : [
        new ol.layer.Tile({
          name : 'Capa Base OSM',
          source: new ol.source.OSM()
        }),
        new ol.layer.Tile({
          name : 'Ortofoto PNOA',
          visible : false,
          source : new ol.source.TileWMS({
            url : 'http://www.ign.es/wms-inspire/pnoa-ma',
            params : {
              "LAYERS" : 'OI.OrthoimageCoverage',
              gutter   : 200
            }
          })
        })   
      ]
    });

    // Creamos el mapa
    this.map = new ol.Map({
      layers: [baseLayers],
      target: 'map',
      controls: ol.control.defaults(),
      view: new ol.View({
        projection : 'EPSG:4326', // La proyección la cambiamos enseguida
        maxZoom : 20,
        center: [0, 0],
        zoom: 2
      })
    });
    // Añadimos control de Capas
    this.map.addControl(lysw);
    // Cambiamos a la proyección ETRS89 UTM H30
    this.projService.setProjection(this.map, '25830');
    
    //Añadimos capa WMS de carriles bici
    this.map.addLayer(carrilesBiciLayer);
    // Añadimos capa de ruta
    this.map.addLayer(this.routeLayer);
    // Añadimos capa de estaciones valenbisi (Clúster)
    this.map.addLayer(this.clusterLayer);
    // Añadimos el marcados Overlay OL3
    this.map.addOverlay(this.marker);
    // Quitamos la atribución
    this.hideAttribution();

    // Evento click del mapa - Buscaremos estaciones(Clúster de estaciones) cerca del click
    this.map.on('click', event =>{
      if(event.dragging) return;
      if(this.navigating) return;
      // Comprobamos que hay features en el pixel clicado - Tolerancia 20m
      if(!this.map.hasFeatureAtPixel(event.pixel, 
        { hitTolerance : 20 , layerFilter : l => l.get('name') == 'Paradas de ValenBisi' })
      ) return;
      
      // Coordenada clicada
      let coo = event.coordinate;
      // Elemento más próximo 
      let closest = this.clusterSource.getClosestFeatureToCoordinate(coo);
      //console.log('closest ->', closest);
      // Features del elemento clicado
      let features = closest.get('features');
      
      // Si solo hay una feature
      if(features.length == 1){
        // Mostramos los detalles de la estación
        let modal = this.modalCtrl.create(ModalPage, { properties : features[0].values_ });
        // Escuchamos el evento para cuando se cierre el modal
        modal.onDidDismiss(data =>{
          // Si no se ha clicado sobre "Ir a la parada" no habrá datos
          // de lo contrario devolverá el número de la parada seleccionada
          if(!data) return;

          let loading = this.loadingCtrl.create({ content : 'Obteniendo ruta, espere por favor.' });
          loading.present();

          // Obtenemos en primer lugar la posición del usuario
          let getSourceCoordinates = 
          this.locationService
          .startTracking()
          .subscribe( (position : Geoposition)=>{
            // Si la precisión es mala seguimos buscando el primer punto

            if(position.coords.accuracy > 15) return;
            getSourceCoordinates.unsubscribe();
            // Localización del usuario
            let source = [position.coords.longitude, position.coords.latitude];
            // Buscamos la feature de la parada seleccionada
            let feature = this.vbCollection.features.find(f=>f.properties.number == data);
            // Obtenemos las coordenadas tranformadas a EPSG:4326 de la parada seleccionada
            let destination = ol.proj.transform(feature.geometry.coordinates, 'EPSG:25830', 'EPSG:4326');
            // Nos subscibimos al observable que nos proporciona la ruta entre los dos puntos
            let getRouteData = this.routeService.getData([source, destination]).subscribe(
              // Cuando haya ruta
              routeData => {
                // Cerramos el diálogo
                getRouteData.unsubscribe();
                loading.dismiss();
                //console.log(routeData.json());
                // Obtenemos una de las rutas que nos devuelve el servicio
                let route : IOSMRouteResponse = routeData.json().routes[0];
                if(!route) return; // Si no hay ruta , "pues ná"
                // Obtenemos la ruta en la proyección en la que esté el mapa
                let feature = this.geojsonParser.readFeature(route.geometry, {
                  dataProjection : `EPSG:4326`,
                  featureProjection : this.map.getView().getProjection()
                });

                // Limpiamos la capa de rutas
                this.routeLayer.getSource().clear();
                this.routeLayer.getSource().refresh();
                // Añadimos la ruta a la capa de rutas
                this.routeLayer.getSource().addFeature(feature);
                // Cuando el evento de renderizado del mapa pase al siguiente tick
                // actualizamos la View del mapa
                this.mapViewChange = this.map.on('postcompose', this.updateView.bind(this));
                this.map.render();
                // Escuchamos al Evento para obtener coordenadas 

                this.watchCoordinates = this.locationService.startTracking()
                  .subscribe( (position : Geoposition) =>{
                    this.navigating = true;
                    // Obtenemos la posición en la proyección del mapa
                    let pos = ol.proj.transform([position.coords.longitude, position.coords.latitude], 
                                'EPSG:4326', this.map.getView().getProjection());
                    // Precisión del punto obtenido
                    let accuracy = position.coords.accuracy;
                    // Azimut en grados
                    let heading = position.coords.heading || 0;
                    // Velocidad en m/s
                    let speed = position.coords.speed || 0;
                    // Fecha en la que se obtiene la posición
                    let m = Date.now();
                    // Dibujamos la posición
                    this.addPosition(pos, heading, m, speed, accuracy);
                    // Coordenadas que se han ido obteniendo
                    this.notifyChanges(feature);
                    let coords = this.positions.getCoordinates();
                    // Cuántas coordenadas se han obtenido
                    let len = coords.length;
                    // si se han obtenido más de dos
                    if (len >= 2) {
                      // El nuevo intervalo se el tiempo entre las dos últimas posiciones
                      this.deltaMean = (coords[len - 1][3] - coords[0][3]) / (len - 1);
                    }
                  }, 
                  err => alert(err)
                );
              },
              err => alert(err)
            );
          },
          err => alert(err));
        });
        modal.present();
      }
      // Si hay más de una estación
      else if(features.length > 1){
        // Obtenemos el bounding box que envuelve a todos los puntos
        let bbox = ol.extent.boundingExtent( features.map( f => f.getGeometry().getCoordinates() ) );
        // Actualizamos la View del mapa
        this.map.getView().fit(bbox, this.map.getSize(), { duration : 500 })
      }
    });

    // Nos suscribimos al evento para obtener estaciones ValenBisi
    // Hará una petición cada 60 segundos
    this.vbService.getData()
    //.take(1)
    .subscribe(
      // Cuando haya nuevos datos
      data => {
        console.log('Actualizando VB');
        // Si es la primera vez hacemos zoom sobre las features
        let zoomToFeatures = this.vbCollection ? false : true;
        // Actualizamos la variable vbCollection
        this.vbCollection = data.json();
        // Añadimos la estaciones ValenBisi al mapa
        this.addVBFeatures(zoomToFeatures);
      }
    );

  }

  // Método para cerrar la atribución del mapa de OL3
  hideAttribution(){
    // Recorremos los controles del mapa
    this.map.getControls().forEach(c => {
      // Si el control es de la clase ol.control.Attribution
      if (c instanceof ol.control.Attribution){
        // Eliminamos el control
        this.map.removeControl(c);
      }
    })
  }

  // Método para mostrar el modal de detalle de la estación VB seleccionada
  presentModal(){
    // Creamos el modal
    let modal = this.modalCtrl.create(ModalPage);
    // Lo mostramos
    modal.present();
  }

  // Método para obetener y hacer zoom sobre la calle buscada
  searchAddress(event){
    console.log('searching...');
    // Si se han escrito menos de 3 letras no hacemos nada
    if(event.target.value.length < 3) return;
    // Suscripción al evento para obtener posición a partir de nombre de calle
    this.nominatimService.getData(event.target.value).subscribe(
      // Cuando obtengamos información
      streetInfo => {
        // Obtenemos la primera ocurrencia
        let sinfo : INominatimResponse = streetInfo.json()[0];
        // Si no hay dato - Salimos de la función
        if(!sinfo) return;

        // Obtenemos el bounding box de la calle
        let bbox = sinfo.boundingbox.map(Number);
        // En el formato de OpenLayers
        let [ymin, ymax, xmin, xmax] = bbox;
        // Tranformamos las coordenadas del bbox a la proyección del mapa
        bbox = ol.proj.transformExtent([xmin, ymin, xmax, ymax], 'EPSG:4326', this.map.getView().getProjection());

        console.log(sinfo, sinfo.display_name, sinfo.lon, sinfo.lat);
        // Hacemos zoom al bounding box
        this.map.getView().setCenter([+sinfo.lon, +sinfo.lat]);
        this.map.getView().fit(bbox, this.map.getSize(), { duration : 1000 });
      }
    )
  }

  // Método para añadir las paradas VB al mapa
  addVBFeatures(zoomTo){
    //let epsg = +this.vbCollection.crs.properties.name.match(/EPSG::\d+/)[0].replace('EPSG::', '');
    //console.log(epsg);
    // Obtenemos la feature en la proyección del mapa
    let features = this.geojsonParser.readFeatures(this.vbCollection, {
      dataProjection : 'EPSG:25830',
      featureProjection : this.map.getView().getProjection()
    });

    // Limpiamos la capa de Estaciones VB
    this.clusterSource.getSource().clear();
    this.clusterSource.getSource().refresh();
    // Añadimos las estaciones VB
    this.clusterSource.getSource().addFeatures(features);

    // Si es la primera vez zoomTo será true
    if(zoomTo){
      // Hacemos zoom a las features (Clúster)
      let bbox = ol.extent.boundingExtent(features.map( f => f.getGeometry().getCoordinates() ) );
      this.map.getView().fit(bbox, this.map.getSize());
    }
  } 

  // Método para obtener posición Actual y hacer zoom en el mapa
  getPosition(){
    if(this.isGettingPosition) return;

    let loading = this.loadingCtrl.create({ content : 'Obteniendo su posición, espere por favor.' });
    loading.present();
    try {
      this.isGettingPosition = true;
        // Comprobar si la localización está activada
        Diagnostic.isGpsLocationEnabled().then(gpsEnabled =>{
          // Si la localización no está activa
          if(!gpsEnabled){
            // Mostramos dialogo para que confirme que quiere cambiar el estado de la localización
            Dialogs
            .confirm(`Se necesitan permisos para que la aplicación pueda utilizar la localización del dispositivo. ¿Abrir Ajustes de Localización?`, 'Permiso de localización', ['Abrir ajustes', 'Cancelar'])
            .then(dialogNumber =>{
              // Si acepta mostramos las opciones de localización del dispositivo
              if(dialogNumber == 1) Diagnostic.switchToLocationSettings();
            });
            // El usuario tendrá que volver a volver a a darle al botón :/
            return;
          }

          let s = this.locationService
          .startTracking()
          .subscribe((loc : Geoposition)=>{
            this.isGettingPosition = false;
            
            if(loc.coords.accuracy < 15){
              loading.dismiss();
              s.unsubscribe();
              let coords = ol.proj.transform([loc.coords.longitude, loc.coords.latitude], 
                'EPSG:4326', this.map.getView().getProjection());
              this.map.getView().setCenter(coords);
            }
          })
      });
    } catch (e){ alert(e) }
  }

  // Radianes a grados
  radToDeg(rad) {
    return rad * 360 / (Math.PI * 2);
  }

  // Grados a radianes
  degToRad(deg) {
    return deg * Math.PI * 2 / 360;
  }

  // Módulo
  mod(n) {
    return ((n % (2 * Math.PI)) + (2 * Math.PI)) % (2 * Math.PI);
  }

  // Método para añadir la posición (modo : Watch) del usuario
  addPosition(position, heading, m, speed, accuracy) {
    try {
      // Coordenadas X, Y actuales
      let [x, y] = position;
      // Centramos la posición sobre la ruta si estamos cerca
      let route = this.routeLayer.getSource().getFeatures()[0].getGeometry();
      
      let closestPointToRoute = route.getClosestPoint(position);
      let firstRoutePoint = route.getCoordinates()[0];

      let distance = this.wgs84Sphere.haversineDistance(
          ol.proj.transform(position, this.map.getView().getProjection(), 'EPSG:4326')
        , ol.proj.transform(firstRoutePoint, this.map.getView().getProjection(), 'EPSG:4326')
      );

      if(distance > 65 && accuracy < 15 && !this.recalculatingRoute){
        this.recalculatingRoute = true;

        let distanceToLastPoint = this.lastRecalculatingPosition ?
          this.wgs84Sphere.haversineDistance(
              ol.proj.transform(position, this.map.getView().getProjection(), 'EPSG:4326')
            , ol.proj.transform(this.lastRecalculatingPosition, this.map.getView().getProjection(), 'EPSG:4326')
          ) : Number.MAX_VALUE;

        if(!this.lastRecalculatingPosition){
          this.lastRecalculatingPosition = position;
          this.lastRecalculatingTime = new Date();
        }
        else if(
          distanceToLastPoint < 25 && 
          new Date().getTime() - this.lastRecalculatingTime.getTime() < 60000
        ) return;

        let source = ol.proj.transform(closestPointToRoute, this.map.getView().getProjection(), 'EPSG:4326');
        let destination = ol.proj.transform(
            this.routeLayer.getSource().getFeatures()[0].getGeometry().getLastCoordinate()
          , this.map.getView().getProjection(), 'EPSG:4326');

        let loading = this.loadingCtrl.create({ content : 'Recalculando ruta, espere por favor.' });
        loading.present();
        let routeSubs = this.routeService.getData([source, destination]).subscribe(
          routeData =>{
            this.recalculatingRoute = false;
            loading.dismiss();
            routeSubs.unsubscribe();
            let route : IOSMRouteResponse = routeData.json().routes[0];
            if(!route) {
              loading.dismiss();
              return;
            }
            // Obtenemos la ruta en la proyección en la que esté el mapa
            let feature = this.geojsonParser.readFeature(route.geometry, {
              dataProjection : `EPSG:4326`,
              featureProjection : this.map.getView().getProjection()
            });

            // Limpiamos la capa de rutas
            this.routeLayer.getSource().clear();
            this.routeLayer.getSource().refresh();
            // Añadimos la ruta a la capa de rutas
            this.routeLayer.getSource().addFeature(feature);
          }, 
          err => {loading.dismiss(); alert(err);}
        );
      }

      if(distance < 5){
        position = closestPointToRoute;
        [x , y] = closestPointToRoute;
        let newRoute = [];
        let continue_ = false;
        let routeCoords = route.getCoordinates();

        routeCoords.reduce( (a, b)=>{
          let geom = new ol.geom.LineString([a, b]);
          // [minx, miny, maxx, maxy]
          if(!continue_){
            if(geom.intersectsExtent([x - 0.001, y - 0.001, x + 0.001, y + 0.001])){
              newRoute.push([x, y], b);
              continue_ = true;
            }
          } else{
            newRoute.push(b);
          }
          return b;
        });
        let feature = new ol.Feature({ geometry : new ol.geom.LineString(newRoute) });
        this.routeLayer.getSource().clear();
        this.routeLayer.getSource().refresh();
        this.routeLayer.getSource().addFeature(feature);
      }

      // Pasamos el azimut a radianes
      heading = this.degToRad(heading);
      // Coordenadas que se han ido almacenando
      let fCoords = this.positions.getCoordinates() || [];
      // Última coordenada almacenada
      let previous = fCoords[ (fCoords.length || 1) - 1];
      // Último azimut almacenado
      let prevHeading = previous && previous[2];
      // Si hay último azimut
      if (prevHeading) {
        // Obtenemos Incremento de Azimut
        let headingDiff = heading - this.mod(prevHeading);

        // Forzamos a que el cambio sea menor a 180º
        if (Math.abs(headingDiff) > Math.PI) {
          // Signo
          let sign = (headingDiff >= 0) ? 1 : -1;
          // diff = +-(180 - diff)
          headingDiff = -sign * (2 * Math.PI - Math.abs(headingDiff));
        }
        // Nuevo acimut
        heading = prevHeading + headingDiff;
      }
      // Añadimos nueva Vista del mapa y posición
      this.positions.appendCoordinate([x, y, heading, m]);

      // Solo se alamacenarán las últimas 20 coordenadas
      this.positions.setCoordinates(this.positions.getCoordinates().slice(-20));

      // Utilizamos el marcador correcto en cada caso
      if (heading || speed) {
        this.markerEl.src = 'assets/icon/images/geolocation_marker_heading.png';
      } else {
        this.markerEl.src = 'assets/icon/images/geolocation_marker.png';
      }
    }
    catch(e){
      alert(e);
    }

  }

  // Recentrar la View poniendo las coordenadas a 3/4 de la pantalla desde la parte superior
  getCenterWithHeading(position, rotation, resolution) {
    // Tamaño en píxels del mapa
    let size = this.map.getSize();
    // Altura del mapa
    let height = size[1];

    return [
      position[0] - Math.sin(rotation) * height * resolution * 1 / 4,
      position[1] + Math.cos(rotation) * height * resolution * 1 / 4
    ];
  }

  // Método para actualizar la View del Mapa
  updateView() {
    // use sampling period to get a smooth transition
    let m = Date.now() - this.deltaMean * 1.5;
        m = Math.max(m, this.previousM);
    this.previousM = m;
    // interpolate position along positions LineString
    let c = this.positions.getCoordinateAtM(m, true);
    if (c) {
      this.map.getView().setCenter(this.getCenterWithHeading(c, -c[2], this.map.getView().getResolution()));
      this.map.getView().setRotation(-c[2]);
      this.marker.setPosition(c);
    }
  }

  stopRoute(){
    this.navigating = false;
    this.watchCoordinates.unsubscribe();
    this.map.unByKey(this.mapViewChange);
    this.selectedVBStates = [];
    this.marker.setPosition(undefined);
    this.routeLayer.getSource().clear();
    this.routeLayer.getSource().refresh();
  }

  notifyChanges(vbFeature){
    if(this.selectedVBStates.length == 0){
      this.selectedVBStates.push({ date : new Date(), feature : vbFeature });
      //alert(this.selectedVBStates.length);
      return;
    }
    let now      = new Date();
    let lastDate : Date = this.selectedVBStates[this.selectedVBStates.length - 1].date;
    let lastState = this.selectedVBStates[this.selectedVBStates.length - 1].feature;
    if(now.getTime() - lastDate.getTime() < 60000) return;

    this.selectedVBStates.push({ date : now, feature : vbFeature });
    this.selectedVBStates = this.selectedVBStates.slice(-2);

    let changes = {};
    if(vbFeature.values_.free != lastState.values_.free){
      changes['bornes'] = true;
    }
    if(vbFeature.values_.available != lastState.values_.available){
      changes['bikes'] = true;
    }
    //alert('object keys length' + Object.keys(changes).length);
    if(!Object.keys(changes).length) return;

    LocalNotifications.schedule({
      id : 1,
      text: `Cambios en la parada #${vbFeature.properties.number}
            Bicis libres : ${vbFeature.properties.available}/${vbFeature.properties.total}
            Bornes libres :  ${vbFeature.properties.free}/${vbFeature.properties.total}`
    });
  }

}
