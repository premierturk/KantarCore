import { Component, OnInit, ChangeDetectorRef, ViewChild, HostListener } from '@angular/core';
import { ButtonType, DataSource } from 'src/app/service/datasource';
import { environment } from 'src/environment';
import { ElectronService } from 'ngx-electron';
import { DataStateChangeEvent, GridComponent, GridDataResult, RowClassArgs } from '@progress/kendo-angular-grid';
import { State, aggregateBy, process } from '@progress/kendo-data-query';
import { ExcelExportData } from '@progress/kendo-angular-excel-export';
import * as moment from 'moment';
import { AppNetworkStatus } from 'src/app/network-status';
import * as Notiflix from 'node_modules/notiflix/dist/notiflix-3.2.6.min.js';
import Swal from 'sweetalert2';
import { DropDownFilterSettings } from '@progress/kendo-angular-dropdowns';

@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss']
})
export class DashboardComponent implements OnInit {
  public ButtonType = ButtonType;
  @ViewChild('grid') grid: GridComponent;
  public view: GridDataResult;
  public list: any[] = [];
  public tasimaKabulListesi: any[] = [];
  public mySelections: any[] = [];
  // public Plakalar: any[] = [];
  // public Firmalar: any[] = [];
  public selectedItem: any = {};
  static componentInstance: any;
  private url: string = environment.production ? environment.apiUrl : '/api';
  public ddPlaka: DropdownProps = new DropdownProps();
  public ddFirma: DropdownProps = new DropdownProps();
  public formData: any;
  private emptyFormData: any = { FirmaAdi: '', Tonaj: 0, BelgeNo: '', Dara: 0, Aciklama: '' };
  public total: any = { "Tonaj": { "sum": 0 }, "Tutar": { "sum": 0 } };
  public basTar: Date;
  public bitTar: Date;
  public barcode: string = '';
  public isLoading: boolean = false;
  public raporTuru: any = { kamufis: true, dokumfisi: true, ozel: true, manueldokum: true, gerikazanim: true, evsel: true, sanayi: true };
  public user = JSON.parse(window.localStorage.getItem('user'));
  public depolamaAlanId = window.localStorage.getItem('DepolamaAlanId');
  public state: State = {
    skip: 0,
    take: 19,
  };

  constructor(private ds: DataSource, private _electronService: ElectronService, private ref: ChangeDetectorRef) {

    this.allData = this.allData.bind(this);
    DashboardComponent.componentInstance = this;
    if (this._electronService.ipcRenderer) {
      this._electronService.ipcRenderer.on('kantar', this.onDataKantar);
      this._electronService.ipcRenderer.on('tcp', this.onDataTcp);
    }
  }



  ngOnInit(): void {
    this.initializeFormData();
    var now = new Date();
    this.basTar = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    this.bitTar = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    this.BindGrid();
    this.BindForm();
  }


  @HostListener('window:keydown', ['$event'])
  keyEvent(event: KeyboardEvent) {
    if (event.key == 'Enter') {
      console.log(this.barcode);
      this.belgeNoFromBarcode(this.barcode);


      this.barcode = '';
      return;
    }
    this.barcode += event.key;
  }

  public async belgeNoFromBarcode(code) {
    var barkodBelge = this.getBelgeNo(code);
    //this.formData.BelgeNo = barkodBelge;
    var tasimaKabulKontrol = this.tasimaKabulListesi.filter(x => x.BelgeNo == barkodBelge)[0];

    if (tasimaKabulKontrol != undefined && tasimaKabulKontrol != null) {
      this.formData.BelgeNo = barkodBelge;
      this.ddPlaka.f_list = this.ddPlaka.list.filter(x => tasimaKabulKontrol.IlceBelediyeler_TasimaKabul_Araclar.some(a => a.PlakaNo == x.PlakaNo))
      this.formData.FirmaAdi = tasimaKabulKontrol.AnaTasiyiciFirma;
      this.formData.Dara = 0;
      this.formData.AracId = undefined;

      // setTimeout(() => {
      //   this.save();
      // }, 3000);

      // return barkodBelge;

    }
    else {
      this.formData.FirmaAdi = '';
      //Notiflix.Notify.failure('Geçersiz Belge No!');
    }
  }
  getBelgeNo(readed: any) {
    var index = readed.indexOf("-");
    if (index < 0) return "";

    var left = "";
    for (let i = index - 1; i >= 0; i--) {
      const c = readed[i];
      if (c >= '0' && c <= '9') left = c + left;
      else break; //2
    }

    var right = readed.substring(index, index + 5);//-2023

    return left + right;
  }

  public plakaChange(aracId) {
    const arac = this.ddPlaka.list.filter((x) => x.AracId == aracId)[0];
    if (arac != undefined && arac != null) {
      this.formData.AracId = arac.AracId;
      this.formData.Dara = arac.Dara;

      // setTimeout(() => {
      //   this.save();
      // }, 3000);

    }
  }

  public async BindForm() {
    this.ddPlaka = new DropdownProps("PlakaNo", await this.ds.get(`${this.url}/kantar/araclistesi?EtiketNo=`));
    this.ddFirma = new DropdownProps("FirmaAdi", await this.ds.get(`${this.url}/FirmaListesiByCariHesapTuru`));
    this.tasimaKabulListesi = await this.ds.get(`${this.url}/SahaIsletmeciEntegrasyon/TasimaKabulListesi?isAktif=true`);
  }


  public async BindGrid() {
    if (this.formData.firmaId == undefined) {
      this.formData.firmaId = "";
    }
    this.clearSelections();
    if (this.basTar != undefined && this.bitTar != undefined) {
      var query = this.user.buyuksehirid + "#" + this.basTar.toUTCString() + "#" + this.bitTar.toUTCString() + "#" + this.formData.firmaId + "#" + this.depolamaAlanId + "#" + "" + "#" + this.raporTuru.kamufis + "#" + this.raporTuru.dokumfisi + "#" + this.raporTuru.ozel + "#" + this.raporTuru.manueldokum + "#" + this.raporTuru.gerikazanim + "#" + "Hayir" + "#" + this.raporTuru.evsel + "#" + this.raporTuru.sanayi + "#" + this.user.userid;

      this.list = await this.ds.get(`${this.url}/ParaYukleme/GetRaporMulti?q=${btoa(query)}`);
      this.view = process(this.list, this.state);
      this.total = aggregateBy(this.list, [{ field: 'Tonaj', aggregate: 'sum' }, { field: 'Tutar', aggregate: 'sum' }]);
    }
  }

  public initializeFormData() {
    this.formData = {};
    this.ref.detectChanges();
    for (const property in this.emptyFormData) this.formData[property] = this.emptyFormData[property];
    this.ref.detectChanges();
  }

  public onCellClick(a) {
    this.selectedItem = a.dataItem;
  }

  public dataStateChange(state: DataStateChangeEvent): void {
    this.state = state;
    this.view = process(this.list, this.state);
  }

  public rowCallback = (context: RowClassArgs) => {
    return { localData: context.dataItem.HafriyatDokumId == null };
  };

  async excel() {
    this.grid.saveAsExcel();
  }

  public allData(): ExcelExportData {
    var excelList = this.list;
    for (var item of excelList) {
      item.IslemTarihi = moment(new Date(item.IslemTarihi)).format("DD/MM/yyyy HH:mm");
    }
    const result: ExcelExportData = process(excelList, {});
    return result;
  }


  public responseToPrint(data) {
    if (data == null) return;

    var print = data; //offline request response

    if (data.fisno!) { //web service response
      print = {
        KantarAdi: window.localStorage.getItem("KantarAdi"),
        HafriyatDokumId: data.fisno,
        BelgeNo: data.belgeno,
        PlakaNo: data.plakano,
        IslemTarihi: data.islemtarihi + " " + data.islemsaat,
        FirmaAdi: data.firma,
        Dara: data.dara,
        Tonaj: data.tonaj,
        NetTonaj: data.net,
      }
    }


    if (this._electronService.ipcRenderer)
      this._electronService.ipcRenderer.send('onprint', [print]);

    this.clearSelections();
  }

  public gridToPrint(data) {
    if (data == null) return;

    var print = {
      KantarAdi: window.localStorage.getItem("KantarAdi"),
      HafriyatDokumId: data.HafriyatDokumId,
      BelgeNo: data.BelgeNo,
      PlakaNo: data.PlakaNo,
      IslemTarihi: moment(new Date(data.IslemTarihi)).format("DD.MM.yyyy HH:mm"),
      FirmaAdi: data.FirmaAdi,
      Dara: data.Dara,
      Tonaj: data.Tonaj + data.Dara,
      NetTonaj: data.Tonaj,
    };
    if (this._electronService.ipcRenderer)
      this._electronService.ipcRenderer.send('onprint', [print]);

    this.clearSelections();
  }

  public clearSelections() {
    this.selectedItem = undefined;
    this.mySelections = [];
  }

  onDataKantar(event, data) {
    console.log(data);
    const component = DashboardComponent.componentInstance;
    component.formData.Tonaj = parseInt(data[0]);
    component.ref.detectChanges();
    // setTimeout(() => {
    //   component.save();
    // }, 3000);
  }


  onDataTcp(event, data) {
    console.log(data);
    const component = DashboardComponent.componentInstance;
    var arac = component.ddPlaka.list.filter(x => x.OGSEtiket == data)[0];
    if (arac == undefined) {
      return;
    }
    component.formData.AracId = arac.AracId;
    component.ref.detectChanges();
    component.plakaChange(arac.AracId);

  }

  async daraGuncelle() {

    if (this.formData.AracId == null || this.formData.AracId == undefined || this.formData.Tonaj == null || this.formData.Tonaj < 1) {
      Notiflix.Notify.failure('Araç veya tonaj bilgisi alınamadı!');
      return;
    }

    const arac = this.ddPlaka.list.filter((x) => x.AracId == this.formData.AracId)[0];

    const willDelete = await Swal.fire({
      title: `${arac.PlakaNo} plakalı aracın darası ${this.formData.Tonaj} kg olarak güncellensin mi?`,
      type: 'warning',
      showCloseButton: false,
      showCancelButton: true,
      allowOutsideClick: false,
      cancelButtonText: 'Hayır',
      confirmButtonText: 'Evet',
    });

    if (willDelete.value != true) return;

    this.isLoading = true;
    var result = await this.ds.post(`${this.url}/kantar/DaraDegisimi`, { AracId: this.formData.AracId, Dara: this.formData.Tonaj });
    this.isLoading = false;
    if (result.success) {
      this.initializeFormData();
      this.ddPlaka = new DropdownProps("PlakaNo", await this.ds.get(`${this.url}/kantar/araclistesi?EtiketNo=`));
    }
  }

  async save() {
    this.formData.IsOffline = AppNetworkStatus.isOffline;

    var err = this.validations();
    if (err != '') {
      Notiflix.Notify.failure(err);
      return;
    }
    else if (this.isLoading == false) {
      this.isLoading = true;
      var result = await this.ds.post(`${this.url}/kantar/hafriyatkabul/KabulBelgesi`, { AracId: this.formData.AracId, FirmaId: null, SahaId: null, UserId: this.user.userid, BelgeNo: this.formData.BelgeNo, BarkodNo: this.formData.BelgeNo, DepolamaAlanId: this.depolamaAlanId, Tonaj: this.formData.Tonaj, Dara: this.formData.Dara, GirisCikis: 'Giriş' });
      this.isLoading = false;
      if (result.success) {
        if (this._electronService.ipcRenderer)
          this._electronService.ipcRenderer.send('bariyer');
        this.responseToPrint(result.data);
        this.initializeFormData();
        this.BindGrid();
      }
    }
  }


  public validations(): string {
    var s = '';
    if (this.formData.AracId == null) s = 'Lütfen plaka seçin.';
    else if (this.formData.FirmaAdi == null) s = 'Firma Adı bulunamadı.';
    else if (this.formData.BelgeNo == null || this.formData.BelgeNo == '') s = 'Barkod Okutunuz.';
    else if (this.formData.Dara == null || this.formData.Dara < 1) s = 'Dara bulunamadı.';
    else if (this.formData.Tonaj == null || this.formData.Tonaj < 1) s = 'Tonaj bulunamadı.';
    else if (this.formData.Tonaj < this.formData.Dara && this.formData.Tonaj > 1) s = 'Dara Tonajdan büyük olamaz.';
    return s;
  }

  public filterSettings: DropDownFilterSettings = {
    caseSensitive: false,
    operator: "startsWith",
  };

  public handleFilter(value, dropdownName) {
    if (dropdownName == 'Plaka') {
      if (value.length < 1) {
        this.ddPlaka.f_list = [];
      }
      else {
        this.ddPlaka.f_list = this.ddPlaka.f_list;
      }
    }
    else {
      if (value.length < 1) {
        this.ddFirma.f_list = [];
      }
      else {
        this.ddFirma.f_list = this.ddFirma.f_list;
      }
    }

  }
}



class DropdownProps {
  list: any[] = [];
  f_list: any[] = [];
  displayField: string = "";

  constructor(displayField = "", list = []) {
    this.displayField = displayField;
    this.list = list;
    this.f_list = list;
  }

  onChange(keyword) {
    this.f_list = this.list.filter((x) => x[this.displayField].includes(keyword.toUpperCase()));
  }


}


