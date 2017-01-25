//http://router.project-osrm.org/route/v1/driving/13.388860,52.517037;13.397634,52.529407;13.428555,52.523219?geometries=geojson&alternatives=true&overview=full

import { Injectable } from '@angular/core';
import { Http } from '@angular/http';


@Injectable()
export class OSMRouteService {
    constructor(private http : Http){}

    getData(coordinates : number[][]){
        let coordsStr = coordinates.map( coor => coor.join()).join(';');
        return this.http.get(`http://router.project-osrm.org/route/v1/driving/${coordsStr}?geometries=geojson&alternatives=true&overview=full`)
    }

}