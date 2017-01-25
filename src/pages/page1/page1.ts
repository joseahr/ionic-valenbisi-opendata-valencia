import { Component, ViewChild } from '@angular/core';
import { LocalNotifications, Geolocation, Geoposition, Diagnostic } from 'ionic-native';
import { ModalController, NavController, Platform, Searchbar } from 'ionic-angular';
//import { Insomnia } from 'ionic-native';
import { IVBCollection, INominatimResponse, IOSMRouteResponse } from '../../interfaces';
import { EstacionesVBService } from '../../services/estaciones-valenbisi.service';
import { ProjectionService } from '../../services/projection.service';
import { StyleService } from '../../services/styles.service';
import { LocationService } from '../../services/location.service';
import { NominatimService } from '../../services/geocoder.service';
import { OSMRouteService } from '../../services/routes.service';
import { ModalPage } from '../modal/modal';

declare const ol: any;
declare const proj4: any;


@Component({
  selector: 'page-page1',
  templateUrl: 'page1.html',
  providers : [EstacionesVBService, ProjectionService, StyleService, LocationService, NominatimService, OSMRouteService]
})
export class Page1 {

  @ViewChild('sb') searchBar : Searchbar;

  ol : any;
  map : any;
  geojsonParser : any;
  proj4 : any;

  layerVB : any;
  clusterSource : any;
  clusterLayer : any;

  vbCollection : IVBCollection;

  searching : Boolean = false;

  searchLayer : any;
  routeLayer : any;
  myLocationLayer : any;

  positions : any;
  previousM : number = 0;
  marker : any;
  markerEl : any;
  deltaMean : number = 500; // the geolocation sampling period mean in ms

  constructor(
    public navCtrl: NavController, 
    public modalCtrl : ModalController,
    public vbService : EstacionesVBService,
    public projService : ProjectionService, 
    public styleService : StyleService,
    public locationService : LocationService,
    public nominatimService : NominatimService,
    public routeService : OSMRouteService,
    public platform : Platform
  ) {

    /*this.locationService.startTracking( (location, mode)=>{
      LocalNotifications.schedule({
        id: 1,
        text: mode + '',
      });
    });*/
        
  }

  ngOnInit() : void {

    //setInterval( ()=>{ this.searching = !this.searching }, 3000);

    this.geojsonParser = new ol.format.GeoJSON();

    this.searchLayer = new ol.layer.Vector({
      source : new ol.source.Vector()
    });

    this.routeLayer = new ol.layer.Vector({
      source : new ol.source.Vector(),
      style  : this.styleService.getRouteStyle()
    });

    this.myLocationLayer = new ol.layer.Vector({
      source : new ol.source.Vector()
    });

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
      name: 'Cluster',
			source: this.clusterSource,
			animationDuration: 700,
			style: this.styleService.getClusterStyle()
		});

    this.map = new ol.Map({
      layers: [
        new ol.layer.Tile({
          source: new ol.source.OSM()
        })
      ],
      target: 'map',
      controls: ol.control.defaults(),
      view: new ol.View({
        projection : 'EPSG:4326',
        maxZoom : 20,
        center: [0, 0],
        zoom: 2
      })
    });

    this.map.addLayer(this.searchLayer);
    this.map.addLayer(this.routeLayer);
    this.map.addLayer(this.myLocationLayer);
    this.map.addLayer(this.clusterLayer);

    this.map.addOverlay(this.marker);

    this.hideAttribution();

    let selectCluster = new ol.interaction.SelectCluster({
    });

    this.map.addInteraction(selectCluster);

    selectCluster.getFeatures().on(['add'], (e)=>{
     let features = e.element.get('features');
     
      if(features.length == 1){
        console.log(features, 'fff')
        let modal = this.modalCtrl.create(ModalPage, { properties : features[0].values_ });
        modal.onDidDismiss(data =>{
          if(!data) return;
          console.log(data, 'modal');
          Geolocation.getCurrentPosition().then( (position : Geoposition)=>{
            let source = [position.coords.longitude, position.coords.latitude];
            let feature = this.vbCollection.features.find(f=>f.properties.number == data);
            let destination = ol.proj.transform(feature.geometry.coordinates, 'EPSG:25830', 'EPSG:4326');
            console.log(destination, 'desttt');
            let subs = this.routeService.getData([source, destination]).subscribe(
              routeData => {
                console.log(routeData.json());
                let route : IOSMRouteResponse = routeData.json().routes[0];
                if(!route) return;
                let feature = this.geojsonParser.readFeature(route.geometry);
                this.routeLayer.getSource().clear();
                this.routeLayer.getSource().refresh();
                this.routeLayer.getSource().addFeature(feature);
                subs.unsubscribe();
                // Obtener la posición
                this.map.on('postcompose', this.updateView.bind(this));
                this.map.render();
                this.locationService.startTracking(
                  (position : Geoposition) =>{
                    let pos = [position.coords.longitude, position.coords.latitude];
                    let accuracy = position.coords.accuracy;
                    let heading = position.coords.heading || 0;
                    let speed = position.coords.speed || 0;
                    let m = Date.now();

                    this.addPosition(pos, heading, m, speed);

                    let coords = this.positions.getCoordinates();
                    let len = coords.length;
                    if (len >= 2) {
                      this.deltaMean = (coords[len - 1][3] - coords[0][3]) / (len - 1);
                    }
                  }
                )
              }
            );

          });
          // Avisarle al usuario de que escoja la posición inicial
          //this.routeService.getData([]);
        });
        modal.present();
      }
      else if(features.length > 1){
        let bbox = ol.extent.boundingExtent( features.map( f => f.getGeometry().getCoordinates() ) );
        this.map.getView().fit(bbox, this.map.getSize(), { duration : 500 })
      }
    });

    this.vbService.getData()
    //.take(1)
    .subscribe(
      data => {
        console.log('Actualizando VB')
        let zoomToFeatures = this.vbCollection ? false : true;
        this.vbCollection = data.json();
        this.addVBFeatures(zoomToFeatures);
      }
    );

  }

  hideAttribution(){
    this.map.getControls().forEach(c => {
      if (c instanceof ol.control.Attribution){
        this.map.removeControl(c);
      }
    })
  }

  presentModal(){
    console.log('modal');
    let modal = this.modalCtrl.create(ModalPage);
    modal.present();
  }

  searchAddress(event){
    console.log('searching...');
    if(event.target.value.length < 3) return;
    this.nominatimService.getData(event.target.value).subscribe(
      streetInfo => {
        let sinfo : INominatimResponse = streetInfo.json()[0];
        if(!sinfo) return;

        let bbox = sinfo.boundingbox.map(Number);
        let [ymin, ymax, xmin, xmax] = bbox;
        bbox = [xmin, ymin, xmax, ymax]

        let feature = new ol.Feature({
          geometry : new ol.geom.Point([+sinfo.lon, +sinfo.lat])
        });
        console.log(sinfo, sinfo.display_name, sinfo.lon, sinfo.lat);
        this.searchLayer.getSource().clear();
        this.searchLayer.getSource().refresh();
        //this.searchLayer.getSource().addFeature(feature);

        this.map.getView().setCenter([+sinfo.lon, +sinfo.lat]);
        this.map.getView().fit(bbox, this.map.getSize(), { duration : 1000 });
      }
    )
  }

  addVBFeatures(zoomTo){
    let epsg = +this.vbCollection.crs.properties.name.match(/EPSG::\d+/)[0].replace('EPSG::', '');
    //console.log(epsg)
    let projSubs = this.projService.getProjDef(epsg).subscribe( projDef =>{
      //console.log(projDef.text());
      proj4.defs(`EPSG:${epsg}`, projDef.text());

      console.log(projDef);

      let features = this.geojsonParser.readFeatures(this.vbCollection, {
        dataProjection : `EPSG:${epsg}`,
        featureProjection : 'EPSG:4326'
      });

      this.clusterSource.getSource().clear();
      this.clusterSource.getSource().refresh();
      this.clusterSource.getSource().addFeatures(features);
      //this.clusterSource.setStyle(this.styleService.getStyle());

      if(zoomTo){
        let bbox = ol.extent.boundingExtent(features.map( f => f.getGeometry().getCoordinates() ) );
        this.map.getView().fit(bbox, this.map.getSize());
      }
      
      projSubs.unsubscribe();

    })
  } 

  getPosition(){
    Geolocation.getCurrentPosition().then( (position : Geoposition)=>{
      console.log('ppppppppp', position);
      let feature = new ol.Feature({
        geometry : new ol.geom.Point([position.coords.longitude, position.coords.latitude])
      });
      this.myLocationLayer.getSource().clear();
      this.myLocationLayer.getSource().refresh();
      this.myLocationLayer.getSource().addFeature(feature);
      this.map.getView().setCenter([position.coords.longitude, position.coords.latitude])
    })
  }

  // convert radians to degrees
  radToDeg(rad) {
    return rad * 360 / (Math.PI * 2);
  }
  // convert degrees to radians
  degToRad(deg) {
    return deg * Math.PI * 2 / 360;
  }
  // modulo for negative values
  mod(n) {
    return ((n % (2 * Math.PI)) + (2 * Math.PI)) % (2 * Math.PI);
  }

  addPosition(position, heading, m, speed) {
    let x = position[0];
    let y = position[1];
    let fCoords = this.positions.getCoordinates();
    let previous = fCoords[fCoords.length - 1];
    let prevHeading = previous && previous[2];
    if (prevHeading) {
      let headingDiff = heading - this.mod(prevHeading);

      // force the rotation change to be less than 180�
      if (Math.abs(headingDiff) > Math.PI) {
        let sign = (headingDiff >= 0) ? 1 : -1;
        headingDiff = -sign * (2 * Math.PI - Math.abs(headingDiff));
      }
      heading = prevHeading + headingDiff;
    }
    this.positions.appendCoordinate([x, y, heading, m]);

    // only keep the 20 last coordinates
    this.positions.setCoordinates(this.positions.getCoordinates().slice(-20));

    // FIXME use speed instead
    if (heading && speed) {
      this.markerEl.src = 'assets/icon/images/geolocation_marker_heading.png';
    } else {
      this.markerEl.src = 'assets/icon/images/geolocation_marker.png';
    }
  }

  // recenters the view by putting the given coordinates at 3/4 from the top or
  // the screen
  getCenterWithHeading(position, rotation, resolution) {
    let size = this.map.getSize();
    let height = size[1];

    return [
      position[0] - Math.sin(rotation) * height * resolution * 1 / 4,
      position[1] + Math.cos(rotation) * height * resolution * 1 / 4
    ];
  }

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

}
