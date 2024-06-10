import { Component, OnInit, ChangeDetectorRef, ViewChild, HostListener } from '@angular/core';
import { ButtonType, DataSource } from 'src/app/service/datasource';
import { ElectronService } from 'ngx-electron';
import { DataStateChangeEvent, GridComponent, GridDataResult, RowClassArgs } from '@progress/kendo-angular-grid';
import { State, aggregateBy, process } from '@progress/kendo-data-query';
import { ExcelExportData } from '@progress/kendo-angular-excel-export';
import * as moment from 'moment';
import { AppNetworkStatus } from 'src/app/network-status';
import * as Notiflix from 'node_modules/notiflix/dist/notiflix-3.2.6.min.js';
import Swal from 'sweetalert2';
import { DropDownFilterSettings } from '@progress/kendo-angular-dropdowns';
import { KantarConfig } from 'src/app/helper/kantar-config';
import helper from 'src/app/service/helper';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { SahaSecimiComponent } from './saha-secimi/saha-secimi.component';

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
  public kamuFisListesi: any[] = [];
  public depolamaAlani;
  public mySelections: any[] = [];
  // public Plakalar: any[] = [];
  // public Firmalar: any[] = [];
  public selectedItem: any = {};
  static componentInstance: any;
  private url: string = this.kantarConfig.serviceUrl;
  public ddPlaka: DropdownProps = new DropdownProps();
  public ddFirma: DropdownProps = new DropdownProps();
  public formData: any;
  private emptyFormData: any = { FirmaAdi: '', Tonaj: 0, BelgeNo: '', Dara: 0, Aciklama: '' };
  public total: any = { "Tonaj": { "sum": 0 }, "Tutar": { "sum": 0 } };
  public basTar: Date;
  public bitTar: Date;
  public barcode: string = '';
  public barkodTuru: string = '';
  public isLoading: boolean = false;
  public plakaDisable: boolean = false;
  public aracTakipKontrol: boolean = true;
  public raporTuru: any = { kamufis: true, dokumfisi: true, ozel: true, manueldokum: true, gerikazanim: true, evsel: true, sanayi: true };
  public user = JSON.parse(window.localStorage.getItem('user'));
  // public depolamaAlanId = window.localStorage.getItem('DepolamaAlanId');
  public state: State = {
    skip: 0,
    take: 19,
  };

  constructor(private ds: DataSource, private _electronService: ElectronService, private ref: ChangeDetectorRef, public kantarConfig: KantarConfig,
    public help: helper,
    public modalService: NgbModal
  ) {

    this.allData = this.allData.bind(this);
    DashboardComponent.componentInstance = this;
    if (this._electronService.ipcRenderer) {
      this._electronService.ipcRenderer.on('kantar', this.onDataKantar);
      this._electronService.ipcRenderer.on('tcp', this.onDataTcp);
    }
    window.addEventListener("online", () => {
      this.formData.IsOffline = false;
    });

    window.addEventListener("offline", () => {
      this.formData.IsOffline = true;
    });
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
    code = code.replaceAll("Shift", "");
    this.formData.BarkodNo = code;
    var barkodKontrol = code.replaceAll("*", "-");
    if (barkodKontrol.startsWith("KF-") && barkodKontrol.endsWith("-KF"))   // KAMU FİŞ
    {
      this.barkodTuru = "Kamu Fiş";

      if (!this.formData.IsOffline) {

        var fisTeslimId = barkodKontrol.substring(3, 9);
        var kamuFis = await this.ds.post(`${this.url}/kantar/KamuFisKontrol`, { "FisTeslimId": fisTeslimId });
        this.formData.FirmaAdi = kamuFis.data.FirmaAdi;
        this.ddPlaka.f_list = this.ddPlaka.list.filter(x => kamuFis.data.Araclar.some(a => a.PlakaNo == x.PlakaNo))
        this.formData.BelgeNo = barkodKontrol;
        this.formData.Dara = 0;
        this.formData.AracId = undefined;
      }
      else {
        var kamuFisListesi = this.kamuFisListesi.filter(x => x.FisTeslimId == fisTeslimId)[0];
        if (kamuFisListesi != undefined && kamuFisListesi != null) {
          this.formData.BelgeNo = barkodKontrol;
          this.ddPlaka.f_list = this.ddPlaka.list.filter(x => kamuFisListesi.Araclar.some(a => a.AracId == x.AracId))
          this.formData.FirmaAdi = this.ddFirma.f_list.filter(x => x.FirmaId == kamuFisListesi.FirmaId)[0].FirmaAdi;
          this.formData.Dara = 0;
          this.formData.AracId = undefined;

        }

      }
    }
    else if (barkodKontrol.includes("-") && barkodKontrol.includes("A")) {    // KABUL BELGESİ
      this.barkodTuru = "Kabul Belgesi";

      var barkodBelge = this.getBelgeNo(code);
      barkodBelge = barkodBelge.replace("*", "-")
      var tasimaKabulKontrol = this.tasimaKabulListesi.filter(x => x.BelgeNo == barkodBelge)[0];

      if (tasimaKabulKontrol != undefined && tasimaKabulKontrol != null) {
        this.formData.BelgeNo = barkodBelge;
        this.ddPlaka.f_list = this.ddPlaka.list.filter(x => tasimaKabulKontrol.Araclar.some(a => a.PlakaNo == x.PlakaNo))
        this.formData.FirmaAdi = tasimaKabulKontrol.FirmaAdi;
        this.formData.Dara = 0;
        this.formData.AracId = undefined;

        // setTimeout(() => {
        //   this.save();
        // }, 3000);

        // return barkodBelge;

      }
      else {
        this.formData.FirmaAdi = '';
        Notiflix.Notify.failure('Belge Bulunamadı.');
      }
    }
    else if (!barkodKontrol.includes("-") && barkodKontrol.includes("A") && barkodKontrol.endsWith("A1")) {   // NAKİT DÖKÜM

      this.barkodTuru = "Nakit Döküm";
      var firmId = barkodKontrol.split('A')[1]
      if (this.formData.IsOffline) {
        var firma = this.ddFirma.f_list.filter(x => x.FirmaId == firmId)[0];
        if (firma == null) {
          Notiflix.Notify.failure("Firma Bulunamadı")
          return;
        }
        else {
          var araclist = JSON.parse(localStorage.getItem("araclistesi"))
          var arac = araclist.filter(x => x.FirmaAdi == firma.FirmaAdi);
          if (arac == null) {
            Notiflix.Notify.failure("Firmaya ait araç bulunamadı")
            return;
          }
          this.ddPlaka.f_list = this.ddPlaka.list.filter(x => arac.some(a => a.PlakaNo == x.PlakaNo))
          this.formData.BelgeNo = barkodKontrol;
          this.formData.FirmaAdi = firma.FirmaAdi;
          this.formData.Dara = 0;
          this.formData.AracId = undefined;
        }

      }
      else {
        var nakitDokum = await this.ds.post(`${this.url}/kantar/NakitDokumKontrol`, { 'BelgeNo': firmId });
        if (nakitDokum.success) {
          this.formData.BelgeNo = barkodKontrol;
          this.ddPlaka.f_list = this.ddPlaka.list.filter(x => nakitDokum.data.Araclar.some(a => a.PlakaNo == x.PlakaNo))
          this.formData.FirmaAdi = nakitDokum.data.FirmaAdi;
        }
      }



    }

  }
  getBelgeNo(readed: any) {
    var index = readed.indexOf("*");
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

      if (!arac.AracTakipVarmi) {
        Notiflix.Notify.failure("Araç Takip Sözleşmesi Yoktur.")
        this.aracTakipKontrol = false;

      }
      else if (arac.TasimaIzinAktif == "Pasif") {
        Notiflix.Notify.failure("Taşıma İzin Süresi Dolmuştur")
        this.aracTakipKontrol = false;

      }
      else {
        this.formData.AracId = arac.AracId;
        this.aracTakipKontrol = true;

      }
      this.formData.Dara = arac.Dara;

      // setTimeout(() => {
      //   this.save();
      // }, 3000);

    }
  }

  public async BindForm() {
    this.ddPlaka = new DropdownProps("PlakaNo", await this.ds.get(`${this.url}/kantar/araclistesi?EtiketNo=`));
    this.ddFirma = new DropdownProps("FirmaAdi", await this.ds.get(`${this.url}/FirmaListesiByCariHesapTuru`));
    this.tasimaKabulListesi = await this.ds.get(`${this.url}/kantar/TasimaKabulListesiAktif`);
    this.kamuFisListesi = await this.ds.get(`${this.url}/kantar/KamuFisListesi`);
    this.depolamaAlani = await this.ds.get(`${this.url}/kantar/DepolamaAlani?DepolamaAlaniId=${this.kantarConfig.depolamaAlanId}`);
    if (this.depolamaAlani.DepoalamaAlani.OgsAktif) {
      this.plakaDisable = true;
    }
    setInterval(async () => {
      this.tasimaKabulListesi = await this.ds.get(`${this.url}/kantar/TasimaKabulListesiAktif`);
    }, 60000);

  }


  public async BindGrid() {
    if (this.formData.firmaId == undefined) {
      this.formData.firmaId = "";
    }
    this.clearSelections();
    if (this.basTar != undefined && this.bitTar != undefined) {
      var query = this.user.buyuksehirid + "#" + this.basTar.toUTCString() + "#" + this.bitTar.toUTCString() + "#" + this.formData.firmaId + "#" + this.kantarConfig.depolamaAlanId + "#" + "" + "#" + this.raporTuru.kamufis + "#" + this.raporTuru.dokumfisi + "#" + this.raporTuru.ozel + "#" + this.raporTuru.manueldokum + "#" + this.raporTuru.gerikazanim + "#" + "Hayir" + "#" + this.raporTuru.evsel + "#" + this.raporTuru.sanayi + "#" + this.user.userid;

      this.list = await this.ds.get(`${this.url}/ParaYukleme/GetRaporMulti?q=${btoa(query)}`);
      var offlineKayit = JSON.parse(window.localStorage.getItem('offlineRequests')) // Çift kayıt atıyo
      if (offlineKayit != null) {
        offlineKayit.forEach(element => {
          element.data.sort = 0;
          this.list.push(element.data)
        });
      }
      this.list = this.list.sort(function (a, b) {
        return (new Date(b.IslemTarihi).getTime() - new Date(a.IslemTarihi).getTime() && a.sort - b.sort);
      });
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
    if (context.dataItem.isOffline == true) {
      return { offline: true };
    }
    else if (context.dataItem.HafriyatDokumId == null) {
      return { localData: true };
    }
    else
      return null;
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
    var sahaId = null
    if (this.depolamaAlani.Saha.length > 0) {    // Depolama Alanı Altında Saha varsa Saha seçilir
      const modalRef = this.help.openModal(
        this.modalService,
        SahaSecimiComponent,
        's'
      );
      modalRef.componentInstance.list = this.depolamaAlani;
      await modalRef.result.then(
        (element) => {
          sahaId = element;
        },
        () => { }
      );
    }
    if (this.barkodTuru == "Kabul Belgesi") {
      var netTonaj = this.formData.Tonaj - this.formData.Dara;
      var tasimaKabulKontrol = this.tasimaKabulListesi.filter(x => x.BelgeNo == this.formData.BelgeNo)[0];
      if (tasimaKabulKontrol.AtikMiktariMaxKg != null && tasimaKabulKontrol.AtikMiktariMaxKg < netTonaj) {
        Notiflix.Notify.failure("Dökümü Tamamlanmıştır")
        return;
      }
    }

    this.formData.IsOffline = AppNetworkStatus.isOffline;
    var plakaNo = this.ddPlaka.f_list.filter(x => x.AracId == this.formData.AracId)[0].PlakaNo;
    if (this.formData.IsOffline && this.barkodTuru == "Kamu Fiş") {
      Notiflix.Notify.failure(`${this.formData.BelgeNo} Belgeli Kamu Fiş Atılamadı`)
      return;
    }
    if (this.view.data.length > 0 && this.view.data[0].PlakaNo == plakaNo) {
      Notiflix.Notify.failure(`${plakaNo} TEKRARLAYAN GEÇİŞ`);
      return;
    }
    var err = this.validations();

    if (err != '') {
      Notiflix.Notify.failure(err);
      return;
    }
    else if (this.isLoading == false && this.aracTakipKontrol) {
      this.isLoading = true;
      var result = await this.ds.post(`${this.url}/kantar/hafriyatkabul/KabulBelgesi`, { AracId: this.formData.AracId, FirmaId: null, SahaId: sahaId, UserId: this.user.userid, BelgeNo: this.formData.BelgeNo, BarkodNo: this.formData.BarkodNo, DepolamaAlanId: this.kantarConfig.depolamaAlanId, Tonaj: this.formData.Tonaj, Dara: this.formData.Dara, GirisCikis: 'Giriş', isOffline: this.formData.IsOffline, IslemTarihi: new Date() });
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


