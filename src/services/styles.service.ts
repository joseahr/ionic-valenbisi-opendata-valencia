import { Injectable } from '@angular/core';
declare const ol;
@Injectable()
export class StyleService {
    ol : any;

    cacheStyleCluster = {};

    constructor(){}

    getRouteStyle(){
        return new ol.style.Style({
          stroke: new ol.style.Stroke({
            color: '#00bbff',
            width: 4
          })
        });
    }

    getStyle(){
        return new ol.style.Style({
            image : new ol.style.Icon({
                scale : 0.15,
                opacity: 0.75,
                src: 'assets/icon/bike.png'
            })
        });
    }

    getClusterStyle (){
		return (feature, resolution)=>{
            //let size = feature.get('features').length;

            let availableBikes = 0;
            let totalBikes = 0;
            feature.get('features').forEach( f =>{
                let props = f.getProperties();
                availableBikes += +props.available;
                totalBikes += +props.total;
            });

            let percentage = (availableBikes / totalBikes)*100;
            let color = percentage > 30 ? "0,128,0" : percentage > 10 ? "255,128,0" : "192,0,0";
            let radius = Math.max(15, Math.min(percentage*0.75, 20));
            let dash : any = 2*Math.PI*radius/6;
                dash = [ 0, dash, dash, dash, dash, dash, dash ];
            
            return [
                new ol.style.Style({	
                    image: new ol.style.Circle({	
                        radius: radius,
                        stroke: new ol.style.Stroke({	
                            color: `rgba(${color}, 0.5)`, 
                            width: 15 ,
                            lineDash: dash,
                            lineCap: "butt"
                        }),
                        fill: new ol.style.Fill({	
                            color: `rgba(${color}, 1)`
                        })
                    }),
                    text: new ol.style.Text({	
                        text: `${availableBikes}/${totalBikes}`,
                        font : 'bold 10px arial',
                        fill: new ol.style.Fill({	
                            color: '#fff'
                        })
                    })
                })
            ];

		}
    }

}