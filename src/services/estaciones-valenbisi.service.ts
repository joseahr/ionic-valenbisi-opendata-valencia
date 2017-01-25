import { Injectable } from '@angular/core';
import { Http } from '@angular/http';

import { Observable } from 'rxjs/Rx';



@Injectable()
export class EstacionesVBService {
    constructor(private http : Http){}

    getOnce(){
        return this.http.get('http://mapas.valencia.es/lanzadera/opendata/Valenbisi/JSON');
    }

    getData(){
        let obsSingle = this.http.get('http://mapas.valencia.es/lanzadera/opendata/Valenbisi/JSON');
        let obsSequence = Observable
            .interval(60000)
            .timeInterval()
            .flatMap( ()=>
                this.http.get('http://mapas.valencia.es/lanzadera/opendata/Valenbisi/JSON')
            );
        return Observable.merge(obsSingle, obsSequence);
    }

}