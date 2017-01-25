// Declaramos una interface para que nos sirva de modelo
// Y además VSCode gracias a TS nos autocomplete 
export declare interface IVBFeature {
  geometry : {
    coordinates : Array<number>
  },
  properties : {
    address : string,
    available : string,
    free : string,
    name : string,
    number : string,
    open : string,
    ticket : string,
    total : string,
    updated_at : string
  }
}

export declare interface IVBCollection {
  crs : {
    properties : {
      name : string
    }
  },
  features : Array<IVBFeature>
}

export declare interface IProjection {
    epsg : number | string,
    proj : string
}

export declare interface INominatimResponse {
    address : {
        city : string,
        city_district : string,
        country_code : string,
        country : string,
        road : string,
        state : string,
        suburb : string
    },
    boundingbox : Array<string>,
    display_name : string,
    lon : string,
    lat : string
}

export declare interface IOSMRouteResponse {
    distance : number | string,
    duration : number | string,
    geometry : {
        type : string,
        coordinates : number[][]
    }
}