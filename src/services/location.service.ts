import { Injectable } from '@angular/core';

import { BackgroundGeolocation, Geolocation, Geoposition } from 'ionic-native';

import 'rxjs/add/operator/filter';


@Injectable()
export class LocationService {

    currentCoords : Geoposition;

    watch : any;

    constructor(){}


    startTracking(onchange : Function){
        // Geolocalización cuando la aplicación
        // pasa a segunda plano
        /*let config = {
            desiredAccuracy: 100,
            stationaryRadius: 20,
            distanceFilter: 10, 
            debug: true,
            stopOnTerminate : false,
            pauseLocationUpdates : false,
            interval: 2000 
        };

        BackgroundGeolocation.configure( location => {
            console.log('BackgroundGeolocation:  ' + location.latitude + ',' + location.longitude);
            this.currentCoords = location;

            onchange.call(null, this.currentCoords, 'Segundo plano');

        }, err => {
            alert('configuration error!!!! Fill de puta!!')
            onchange.call(null, this.currentCoords, 'Error Segundo plano');
        }, config);

        if(BackgroundGeolocation.isLocationEnabled()){
            BackgroundGeolocation.start()
            .then( ()=> alert('Background started'))
            .catch( err =>{
                alert('Background error');
                BackgroundGeolocation.showLocationSettings();
                BackgroundGeolocation.watchLocationMode()
                .then(changed => alert('Cambiaste config'))
                .catch(err => alert('Error comfig'))
            });
        } else {

        }*/

        // Geolocalización cuando la aplicación 
        // está en primer plano
        let options = {
            frequency: 3000, 
            enableHighAccuracy: true
        };

        this.watch = 
        Geolocation
        .watchPosition(options)
        .filter((p: any) => p.code === undefined)
        .subscribe((position: Geoposition) => {
            console.log(position);
            this.currentCoords = position;
            onchange.call(null, this.currentCoords, 'Primer plano');
        });


    }

    stopTracking(){
        console.log('stopTracking');
        
        BackgroundGeolocation.finish();
        this.watch.unsubscribe();
    }

    getLastPosition(){
        return this.currentCoords;
    }



}