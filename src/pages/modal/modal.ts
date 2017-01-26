import { Component } from '@angular/core';
import { NavParams, ViewController } from 'ionic-angular';
import { EstacionesVBService } from '../../services/estaciones-valenbisi.service';

/*
  Generated class for the Modal page.

  See http://ionicframework.com/docs/v2/components/#navigation for more info on
  Ionic pages and navigation.
*/
@Component({
  selector: 'page-modal',
  templateUrl: 'modal.html',
  providers : [EstacionesVBService]
})
export class ModalPage {

  selectedVBProps : any;

  constructor(public navParams: NavParams,
              public viewCtrl : ViewController,
              public vbService : EstacionesVBService
  ) {
    this.selectedVBProps = this.navParams.get('properties');
  }

  init(refresher){
    let subs = this.vbService.getOnce().subscribe(
      data => {
        refresher.complete();
        let features = data.json().features;
        console.log(features);
        let estacion = features.find(f=> f.properties.number == this.selectedVBProps.number);
        this.selectedVBProps = estacion.properties;
        subs.unsubscribe();
      }
    );
  }
  ionViewDidLoad() {
    console.log('ionViewDidLoad ModalPage');
  }

  dismiss(params){
    this.viewCtrl.dismiss(params)
  }

}
