import { Injectable } from '@angular/core';

import { Geolocation } from 'ionic-native';

import 'rxjs/add/operator/filter';


@Injectable()
export class LocationService {

    //currentCoords : Geoposition;

    //watch : any;

    constructor(){}


    startTracking(){

        // Geolocalización cuando la aplicación 
        // está en primer plano
        let options = {
            frequency: 3000, 
            enableHighAccuracy: true
        };

       
        return Geolocation
        .watchPosition(options)
        .filter((p: any) => p.code === undefined)
    }

    stopTracking(observable){
        console.log('stopTracking');
        observable.unsubscribe();
    }



}