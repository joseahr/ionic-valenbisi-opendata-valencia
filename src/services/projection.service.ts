import { Injectable } from '@angular/core';
import { Http } from '@angular/http';

import { IProjection } from '../interfaces';

declare const proj4;
declare const ol;

@Injectable()
export class ProjectionService {

    defaultProjections : Array<IProjection> = 
        [{
            code : '25830',
            name : 'ETRS89 / UTM zone 30N',
            proj4 : '+proj=utm +zone=30 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs',
            bbox : [80.53, -6.0, 35.26, 0.0]
        }]


    constructor(private http : Http){}

    getProjDef(epsgCode){
        return this.http.get(`http://epsg.io/${epsgCode}.proj4`);
    }

    setProjection(map, code){
        let proj = this.defaultProjections.find(p => p.code == `${code}`);
        if(!proj){ return; }
        
        proj4.defs(`EPSG:${code}`, proj.proj4);
        let projection = ol.proj.get(`EPSG:${code}`);

        let fromLonLat = ol.proj.getTransform('EPSG:4326', projection);

        let bbox = proj.bbox;
        var extent = ol.extent.applyTransform([bbox[1], bbox[2], bbox[3], bbox[0]], fromLonLat);
        projection.setExtent(extent);

        let view = new ol.View({ projection });
        map.setView(view);
    }

}