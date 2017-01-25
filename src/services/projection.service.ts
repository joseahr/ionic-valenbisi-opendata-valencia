import { Injectable } from '@angular/core';
import { Http } from '@angular/http';

import { IProjection } from '../interfaces';

@Injectable()
export class ProjectionService {

    defaultProjections : Array<IProjection> = 
        [{
            epsg : 25830,
            proj : '+proj=utm +zone=30 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs'
        }, {
            epsg : 25831,
            proj : '+proj=utm +zone=31 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs'        
        }]


    constructor(private http : Http){}

    getProjDef(epsgCode){
        return this.http.get(`http://epsg.io/${epsgCode}.proj4`);
    }

}