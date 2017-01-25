import { Injectable } from '@angular/core';
import { Http } from '@angular/http';

@Injectable()
export class NominatimService {
    constructor(private http : Http){}

    getData(street){
        return this.http.get(`http://nominatim.openstreetmap.org/search/${street}, Valencia Spain?format=json&addressdetails=1&limit=1`);
    }

}