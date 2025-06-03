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
import onScan from 'onscan.js';

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
  public listEnSon: any[] = [];
  public tasimaKabulListesi: any[] = [];
  public speedTest;
  public ddPlakaBelgeFilter: any[] = [];
  public ddTumPlakalar: any[] = [];
  public kamuFisListesi: any[] = [];
  public depolamaAlani;
  public mySelections: any[] = [];
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
  public raporTuru: any = { kamufis: true, dokumfisi: true, ozel: true, manueldokum: false, gerikazanim: false, evsel: false, sanayi: false };
  public user = JSON.parse(window.localStorage.getItem('user'));
  public setinterval;
  public OgsAracId = null;
  public IsOfflineBackUp: boolean;
  public countdown: number = 0;
  public countdownInterval;
  public clearBelgeTimeout;




  public state: State = {
    skip: 0,
    take: 19,
  };

  constructor(public ds: DataSource, private _electronService: ElectronService, private ref: ChangeDetectorRef, public kantarConfig: KantarConfig,
    public help: helper,
    public modalService: NgbModal
  ) {
    this.allData = this.allData.bind(this);
    DashboardComponent.componentInstance = this;

    if (this._electronService.ipcRenderer) {
      this._electronService.ipcRenderer.on('kantar', this.onDataKantar);
      this._electronService.ipcRenderer.on('tcp', this.onDataTcp);
      // this._electronService.ipcRenderer.on('pingHybs', this.pingOffline);

    }
    window.addEventListener("online", () => {
      this.formData.IsOffline = false;
    });

    window.addEventListener("offline", () => {
      this.formData.IsOffline = true;
    });

  }
  public virtual: any = {
    itemHeight: 28,
  };
  ngOnInit(): void {
    this.initializeFormData();

    var now = new Date();
    this.basTar = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    this.bitTar = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    this.afterInit();
  }

  async afterInit() {
    await this.BindForm();
    this.BindGrid();

    onScan.attachTo(document, {
      onScan: function (sScanned) {
        console.log("Barkoddan Okunan Değer:" + sScanned)
        var ilkindex = sScanned.indexOf("A");
        var sonindex = sScanned.lastIndexOf("A");

        if (sScanned.includes("KF")) {
          sScanned = "KF-" + sScanned.split("KF")[1] + "-KF"
          console.log("Barkod Okuyucu Kamu Fiş: " + sScanned)
        }
        else if (sScanned.includes("A") && ilkindex == sonindex) {
          var yil = sScanned.slice(-4);
          sScanned = sScanned.replace(yil, "").concat("-", yil)
          console.log("Barkod Okuyucu Kabul Belgesi: " + sScanned)
        }
        else if (sScanned.includes("A") && ilkindex != sonindex) {
          console.log("Barkod Okuyucu Nakit Döküm: " + sScanned)
        }
        else if (sScanned.length > 4 && sScanned.length < 9) {
          sScanned = sScanned.replace("*", "-");
          if (sScanned.length == 6) {
            sScanned = sScanned[0] + sScanned[1] + "-" + sScanned[2] + sScanned[3] + sScanned[4] + sScanned[5];
          }
          else if (sScanned.length == 5) {
            sScanned = sScanned[0] + "-" + sScanned[1] + sScanned[2] + sScanned[3] + sScanned[4];
          }
        }
        this.barcode = '';
        const component = DashboardComponent.componentInstance;
        component.belgeNoFromBarcode(sScanned)
        component.ref.detectChanges()
      },
      minLength: 5
    });
  }

  ngOnDestroy() {
    onScan.detachFrom(document);
    clearInterval(this.setinterval);
    this.clearInterval();
    // clearInterval(this.hybsPing);
  }

  // @HostListener('window:keydown', ['$event'])
  // keyEvent(event: KeyboardEvent) {
  //   if (event.key == 'Enter') {
  //     console.log("Klavye Girişi: " + this.barcode);
  //     this.belgeNoFromBarcode(this.barcode);

  //     this.barcode = '';
  //     return;
  //   }
  //   this.barcode += event.key;
  // }

  public async belgeNoFromBarcode(code) {
    console.log("Belgeyi Okutunca Parse Edilen Yer: " + code)
    this.formData.BarkodNo = '';
    this.barcode = '';
    var barkodKontrol = code.replaceAll("Shift", "").replaceAll("Control", "").replaceAll("*", "-").toUpperCase();

    if (barkodKontrol.includes("KF-") && barkodKontrol.includes("-KF"))   // KAMU FİŞ
    {
      this.barkodTuru = "Kamu Fiş";
      var indexStart = barkodKontrol.indexOf("KF-");
      var indexEnd = barkodKontrol.indexOf("-KF");
      var fisTeslimId = barkodKontrol.substring(indexStart, indexEnd + 3)
      if (!this.formData.IsOffline) {

        // this.formData.BelgeNo = fisTeslimId;
        // this.formData.BarkodNo=fisTeslimId;

        var kamuFis = await this.ds.post(`${this.url}/kantar/KamuFisKontrol`, { "FisTeslimId": parseInt(fisTeslimId.split('-')[1]) });
        if (kamuFis.success) {
          this.formData.FirmaAdi = kamuFis.data.FirmaAdi;
          this.ddPlaka.f_list = this.ddPlaka.list.filter(x => kamuFis.data.Araclar.some(a => a.PlakaNo == x.PlakaNo))
          // this.formData.Dara = 0;
          // this.formData.AracId = undefined;
        }
        else {
          this.ddPlaka.f_list = [];
          this.formData.FirmaAdi = '';
          this.formData.Dara = 0;
          // this.formData.AracId = undefined;
          this.formData.BarkodNo = '';
          this.barcode = '';
        }
      }
      else {
        var kamuFisListesi = this.kamuFisListesi.filter(x => x.FisTeslimId == fisTeslimId.split('-')[1])[0];
        if (kamuFisListesi != undefined && kamuFisListesi != null) {
          this.ddPlaka.f_list = this.ddPlaka.list.filter(x => kamuFisListesi.Araclar.some(a => a.AracId == x.AracId))
          this.formData.FirmaAdi = this.ddFirma.f_list.filter(x => x.FirmaId == kamuFisListesi.FirmaId)[0].FirmaAdi;
          // this.formData.Dara = 0;
          // this.formData.AracId = undefined;

        }
        else {
          this.ddPlaka.f_list = [];
          this.formData.FirmaAdi = '';
          this.formData.Dara = 0;
          // this.formData.AracId = undefined;
          this.formData.BarkodNo = '';
          this.barcode = '';
          Notiflix.Notify.failure("HATALI/KULLANILMIŞ KAMUFİŞ NO")
          return;
        }
        // this.formData.BelgeNo = fisTeslimId;
        // this.formData.BarkodNo=fisTeslimId;

      }
      this.formData.BelgeNo = fisTeslimId;
      this.formData.BarkodNo = fisTeslimId;
    }
    else if (barkodKontrol.includes("-") && barkodKontrol.includes("A")) {    // KABUL BELGESİ
      this.barkodTuru = "Kabul Belgesi";
      var barkodBelge = this.getBelgeNo(barkodKontrol);

      if (this.formData.IsOffline) {
        var tasimaKabulKontrol = this.tasimaKabulListesi.filter(x => x.BelgeNo == barkodBelge)[0];
        if (tasimaKabulKontrol != undefined && tasimaKabulKontrol != null) {
          if (this.user.ilid !== 57) {
            this.ddPlaka.f_list = this.ddPlaka.list.filter(x => tasimaKabulKontrol.IlceBelediyeler_TasimaKabul_Araclar.some(a => a.PlakaNo == x.PlakaNo))
          }
          this.formData.FirmaAdi = tasimaKabulKontrol.FirmaAdi;
          this.belgeInterval();

        }
        else {
          this.formData.BarkodNo = '';
          this.barcode = '';
          this.formData.FirmaAdi = '';
          this.formData.Dara = 0;
          Notiflix.Notify.failure('Belge Bulunamadı.');
          return;
        }

      }
      else {
        if (this.formData.BelgeNo != barkodBelge) {
          var kabulListesiSorgu = await this.ds.post(`${this.url}/kantar/KabulBelgesiKontrolV2`, { 'BelgeNo': barkodBelge, 'BarkodNo': barkodKontrol });
          if (kabulListesiSorgu.success) {
            if (this.user.ilid !== 57) {
              this.ddPlaka.f_list = this.ddPlaka.list.filter(x => kabulListesiSorgu.data.Araclar.some(a => a.PlakaNo == x.PlakaNo))
            }
            this.formData.FirmaAdi = kabulListesiSorgu.data.FirmaAdi;
            // this.formData.Dara = 0;
            // this.formData.AracId = undefined;
            this.belgeInterval();

          }
          else {
            Notiflix.Notify.failure('Hatalı Belge Numarası (KabulBelgesiKontrolV2).');
            this.formData.BarkodNo = '';
            this.formData.BelgeNo = '';
            this.barcode = '';
            this.formData.FirmaAdi = '';
            this.formData.Dara = 0;
            return;
            // this.formData.AracId = undefined;
          }

        }

      }

      this.formData.BelgeNo = barkodBelge;
      this.formData.BarkodNo = barkodKontrol;
    }
    else if (!barkodKontrol.includes("-") && barkodKontrol.includes("A")) {   // NAKİT DÖKÜM

      this.barkodTuru = "Nakit Döküm";
      var firmId = barkodKontrol.split('A')[1]
      if (this.formData.IsOffline) {
        var firma = this.ddFirma.f_list.filter(x => x.FirmaId == firmId)[0];
        if (firma == null) {
          this.formData.BarkodNo = '';
          this.barcode = '';
          Notiflix.Notify.failure("Firma Bulunamadı")
          return;
        }
        else {
          var araclist = JSON.parse(localStorage.getItem("araclistesi"))
          var arac = araclist.filter(x => x.FirmaAdi == firma.FirmaAdi);
          if (arac == null) {
            this.formData.BarkodNo = '';
            this.barcode = '';
            Notiflix.Notify.failure("Firmaya ait araç bulunamadı")
            return;
          }
          this.ddPlaka.f_list = this.ddPlaka.list.filter(x => arac.some(a => a.PlakaNo == x.PlakaNo))
          this.formData.BelgeNo = barkodKontrol;
          this.formData.FirmaAdi = firma.FirmaAdi;
          // this.formData.Dara = 0;
          // this.formData.AracId = undefined;
        }

      }
      else {
        var nakitDokum = await this.ds.post(`${this.url}/kantar/NakitDokumKontrol`, { 'BelgeNo': firmId });
        if (nakitDokum.success) {
          this.formData.BelgeNo = barkodKontrol;
          this.formData.BarkodNo = barkodKontrol;
          this.ddPlaka.f_list = this.ddPlaka.list.filter(x => nakitDokum.data.Araclar.some(a => a.PlakaNo == x.PlakaNo))
          this.formData.FirmaAdi = nakitDokum.data.FirmaAdi;
          // this.formData.Dara = 0;
          // this.formData.AracId = undefined;
        }
        else {
          this.formData.BarkodNo = '';
          this.formData.BelgeNo = '';
          this.barcode = '';
          this.formData.FirmaAdi = '';
          this.formData.Dara = 0;
          // this.formData.AracId = undefined;
        }
      }

    }
    else if (barkodKontrol.includes("-") && !barkodKontrol.includes("A")) {     // SAKARYA KABUL BELGESİ
      this.barkodTuru = "Kabul Belgesi";

      if (this.formData.IsOffline) {
        var tasimaKabulKontrol = this.tasimaKabulListesi.filter(x => x.BelgeNo == barkodKontrol)[0];
        if (tasimaKabulKontrol != undefined && tasimaKabulKontrol != null) {
          this.ddPlaka.f_list = this.ddPlaka.list.filter(x => tasimaKabulKontrol.IlceBelediyeler_TasimaKabul_Araclar.some(a => a.PlakaNo == x.PlakaNo))
          this.formData.FirmaAdi = tasimaKabulKontrol.FirmaAdi;
          // this.formData.Dara = 0;
          // this.formData.AracId = undefined;
          // this.formData.BarkodNo = barkodKontrol;
        }
        else {
          this.formData.BarkodNo = '';
          this.barcode = '';
          this.formData.FirmaAdi = '';
          this.formData.Dara = 0;
          // this.formData.AracId = undefined;
          Notiflix.Notify.failure('Belge Bulunamadı.');
          return;
        }
      }
      else {
        if (this.formData.BelgeNo != barkodBelge) {
          var kabulListesiSorgu = await this.ds.post(`${this.url}/kantar/KabulBelgesiKontrolV2`, { 'BelgeNo': barkodBelge, 'BarkodNo': barkodKontrol });
          if (kabulListesiSorgu.success) {
            this.ddPlaka.f_list = this.ddPlaka.list.filter(x => kabulListesiSorgu.data.Araclar.some(a => a.PlakaNo == x.PlakaNo))
            this.formData.FirmaAdi = kabulListesiSorgu.data.FirmaAdi;
            // this.formData.Dara = 0;
            // this.formData.AracId = undefined;
          }
          else {
            Notiflix.Notify.failure('Hatalı Belge Numarası (KabulBelgesiKontrolV2).');
            this.formData.BarkodNo = '';
            this.formData.BelgeNo = '';
            this.barcode = '';
            this.formData.FirmaAdi = '';
            this.formData.Dara = 0;
            return;
            // this.formData.AracId = undefined;
          }
        }

      }

      this.formData.BelgeNo = barkodKontrol;
      this.formData.BarkodNo = barkodKontrol;
    }
    // this.ddPlakaBelgeFilter = this.ddPlaka.f_list;
    this.ddPlaka.f_list.forEach(element => {
      this.ddPlakaBelgeFilter.push(element)
    });
    // this.formData.BarkodNo = barkodKontrol;
    if (this.OgsAracId != null) {
      this.plakaChange(this.OgsAracId)
    }
  }

  getBelgeNo(readed: any) {


    var index = Math.max(readed.indexOf("*"), readed.indexOf("-"));
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
    var aracEkliMi = this.ddPlaka.f_list.filter(x => x.AracId == arac.AracId)[0];
    if (aracEkliMi == null || aracEkliMi == undefined) {
      this.ddPlaka.f_list.push(arac);
    }
    if (arac != undefined && arac != null) {

      if (this.barkodTuru == "Nakit Döküm" && this.formData.Tonaj > 80000) {
        if (!arac.AracTakipVarmi) {
          Notiflix.Notify.failure("Araç Takip Sözleşmesi Yoktur.")
          this.aracTakipKontrol = false;
          return;

        }
        else if (arac.TasimaIzinAktif == "Pasif") {
          Notiflix.Notify.failure("Taşıma İzin Süresi Dolmuştur")
          this.aracTakipKontrol = false;
          return;
        }

      }
      else if (this.barkodTuru != "Nakit Döküm") {
        if (!arac.AracTakipVarmi) {
          Notiflix.Notify.failure("Araç Takip Sözleşmesi Yoktur.")
          this.aracTakipKontrol = false;
          return;

        }
        else if (arac.TasimaIzinAktif == "Pasif") {
          Notiflix.Notify.failure("Taşıma İzin Süresi Dolmuştur")
          this.aracTakipKontrol = false;
          return;
        }

      }
      if (this.formData.BelgeNo == '' || this.formData.BelgeNo == null) {
        this.formData.BarkodNo = '';
        this.barcode = '';
      }
      this.formData.AracId = arac.AracId;
      this.aracTakipKontrol = true;
      this.formData.Dara = arac.Dara;

      // setTimeout(() => {
      //   this.save();
      // }, 3000);

    }
  }

  public async BindForm() {
    this.ddPlaka = new DropdownProps("PlakaNo", await this.ds.get(`${this.url}/kantar/araclistesi?EtiketNo=`));
    this.ddTumPlakalar = this.ddPlaka.list;
    this.ddFirma = new DropdownProps("FirmaAdi", await this.ds.get(`${this.url}/FirmaListesiByCariHesapTuru`));
    this.isLoading = true;
    this.kamuFisListesi = await this.ds.get(`${this.url}/kantar/KamuFisListesi`);
    this.tasimaKabulListesi = await this.ds.get(`${this.url}/kantar/TasimaKabulListesiAktif`);
    this.isLoading = false;

    // let startFrom = new Date().getTime();
    // this.speedTest = await this.ds.getNoStorage(`${this.url}/donw5mb`);
    // let finishFrom = ((new Date().getTime() - startFrom) / 5)
    // console.log("SpeedTest: ", finishFrom);

    // if (this.speedTest.status != 200 || finishFrom > 2500) {
    //   this.formData.IsOffline = true;
    // }

    this.depolamaAlani = await this.ds.get(`${this.url}/kantar/DepolamaAlani?DepolamaAlaniId=${this.kantarConfig.depolamaAlanId}`);
    // console.log("Depolama Alanı:" + this.depolamaAlani)
    if (this.depolamaAlani.DepoalamaAlani != null) {
      if (this.depolamaAlani.DepoalamaAlani.OgsAktif) {
        this.plakaDisable = true;
      }
    }


    this.setinterval = setInterval(async () => {
      this.tasimaKabulListesi = await this.ds.get(`${this.url}/kantar/TasimaKabulListesiAktif`);
      this.kamuFisListesi = await this.ds.get(`${this.url}/kantar/KamuFisListesi`);
      console.clear();
    }, 60000);




    // this.hybsPing = setInterval(async () => {
    //   var HybsErisim = await this.ds.getResponse(`${this.url}/kantar/OfflineControl`);
    //   if (HybsErisim.status != 200) {
    //     this.formData.IsOffline = true;
    //   }
    //   else {
    //     this.formData.IsOffline = false;
    //   }
    // }, 120000);
  }

  public async BindGrid() {
    if (this.formData.firmaId == undefined) {
      this.formData.firmaId = "";
    }
    this.clearSelections();
    if (this.basTar != undefined && this.bitTar != undefined) {
      var query = this.user.buyuksehirid + "#" + this.basTar.toUTCString() + "#" + this.bitTar.toUTCString() + "#" + this.formData.firmaId + "#" + this.kantarConfig.depolamaAlanId + "#" + "" + "#" + this.raporTuru.kamufis + "#" + this.raporTuru.dokumfisi + "#" + this.raporTuru.ozel + "#" + this.raporTuru.manueldokum + "#" + this.raporTuru.gerikazanim + "#" + "Hayir" + "#" + this.raporTuru.evsel + "#" + this.raporTuru.sanayi + "#" + this.user.userid;



      var querySonKayit = this.user.buyuksehirid + "#" + new Date().toUTCString() + "#" + new Date().toUTCString() + "#" + this.formData.firmaId + "#" + this.kantarConfig.depolamaAlanId + "#" + "" + "#" + this.raporTuru.kamufis + "#" + this.raporTuru.dokumfisi + "#" + this.raporTuru.ozel + "#" + this.raporTuru.manueldokum + "#" + this.raporTuru.gerikazanim + "#" + "Hayir" + "#" + this.raporTuru.evsel + "#" + this.raporTuru.sanayi + "#" + this.user.userid;

      this.isLoading = true;
      this.list = await this.ds.get(`${this.url}/ParaYukleme/GetRaporMulti?q=${btoa(query)}`);
      this.isLoading = false;

      this.listEnSon = await this.ds.getNoMessage(`${this.url}/ParaYukleme/GetRaporMulti?q=${btoa(querySonKayit)}`);


      var offlineKayit = JSON.parse(window.localStorage.getItem('offlineRequests')) // Offline kayıtların grid de sürekli gösteriminin sağlanması
      if (offlineKayit != null) {
        offlineKayit.forEach(element => {
          element.data.sort = 0;
          this.list.push(element.data)
        });
      }
      this.list = this.list.sort(function (a, b) {

        if (b.sort == a.sort) return new Date(b.IslemTarihi).getTime() - new Date(a.IslemTarihi).getTime();
        else return a.sort - b.sort;

      });
      this.view = process(this.list, this.state);
      this.total = aggregateBy(this.list, [{ field: 'Tonaj', aggregate: 'sum' }, { field: 'Tutar', aggregate: 'sum' }]);


    }
  }


  public clearInterval() {
    this.countdown = 0;
    clearInterval(this.countdownInterval);
    clearTimeout(this.clearBelgeTimeout);

  }

  public belgeInterval() {
    this.clearInterval();
    this.countdown = 30;

    this.countdownInterval = setInterval(() => {
      this.countdown--;
      if (this.countdown <= 0) {
        clearInterval(this.countdownInterval);
      }
    }, 1000);

    this.clearBelgeTimeout = setTimeout(() => {
      this.formData.BelgeNo = '';
      this.formData.FirmaAdi = null;
      this.countdown = 0;
      Notiflix.Notify.warning("Barkodu Tekrar Okutmanız Gerekmektedir.")
    }, 30000);
  }
  public initializeFormData() {
    this.formData = {};
    this.formData.BarkodNo = '';
    this.formData.Tonaj = 0;
    this.barcode = '';
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


  async cezaYaz(item) {
    const willDelete = await Swal.fire({
      title: `Ceza Yazmak İstediğinize Emin Misiniz?`,
      type: 'warning',
      showCloseButton: false,
      showCancelButton: true,
      allowOutsideClick: false,
      cancelButtonText: 'Hayır',
      confirmButtonText: 'Evet',
    });


    if (willDelete.value != true) return;

    this.isLoading = true;
    var result = await this.ds.get(`${this.url}/kantar/ceza?HafriyatDokumId=${item.HafriyatDokumId}`);
    this.isLoading = false;
    if (result != null || result != undefined) {
      this.gridToPrint(item)
      this.BindGrid();
    }
    this.selectedItem = null
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
        KantarAdi: JSON.parse(window.localStorage.getItem("kantarConfig")).kantarAdi,
        HafriyatDokumId: data.fisno,
        IslemTarihi: data.islemtarihi + " " + data.islemsaat,
        FirmaAdi: data.firma,
        PlakaNo: data.plakano,
        Tonaj: data.tonaj,
        Dara: data.dara,
        NetTonaj: data.net,
        Tutar: data.tutar,
        Bakiye: data.bakiye,
        BelgeNo: data.belgeno,
        BelgeMiktari: data.belgemik,
        BelgeTopDok: data.belgetopdok,
        BelgeKalMik: data.belgekalmik,
      }
    }


    if (this._electronService.ipcRenderer)
      this._electronService.ipcRenderer.send('onprint', [print]);

    this.clearSelections();
  }

  public gridToPrint(data) {
    if (data == null) return;
    else if (data.BelgeNo.includes("KF")) return;

    var print = {
      KantarAdi: JSON.parse(window.localStorage.getItem("kantarConfig")).kantarAdi,
      HafriyatDokumId: data.HafriyatDokumId,
      BelgeNo: data.BelgeNo,
      PlakaNo: data.PlakaNo,
      IslemTarihi: moment(new Date(data.IslemTarihi)).format("DD.MM.yyyy HH:mm"),
      FirmaAdi: data.FirmaAdi,
      Dara: data.Dara,
      Tonaj: data.Tonaj + data.Dara,
      NetTonaj: data.Tonaj,
      Tutar: data.Tutar,
      Bakiye: data.Bakiye,
      BelgeMiktari: data.BelgeMiktari,
      BelgeTopDok: data.ToplamDokumMiktari,
      BelgeKalMik: data.BelgeMiktari - data.ToplamDokumMiktari,
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
    // console.log(data);
    const component = DashboardComponent.componentInstance;
    component.formData.Tonaj = parseInt(data[0]);
    component.ref.detectChanges();
    // setTimeout(() => {
    //   component.save();
    // }, 3000);
  }

  onDataTcp(event, data) {
    console.log("OGS Etiket Data: " + data);
    const component = DashboardComponent.componentInstance;
    var arac = component.ddTumPlakalar.filter(x => x.OGSEtiket == data)[0];
    if (arac == undefined) {
      return;
    }
    component.formData.AracId = arac.AracId;
    component.OgsAracId = arac.AracId;
    component.plakaChange(arac.AracId);
    component.ref.detectChanges();

  }

  // pingOffline(event, data) {
  //   const component = DashboardComponent.componentInstance;
  //   component.formData.IsOffline = data;
  // }


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

    var err = this.validations();

    if (err != '') {
      Notiflix.Notify.failure(err);
      return;
    }

    if (this.user.ilid !== 57) {
      var plakaNo = this.ddPlakaBelgeFilter.filter(x => x.AracId == this.formData.AracId)[0];
      if (plakaNo == null || plakaNo == undefined) {
        Notiflix.Notify.failure(`Plaka Belgeye Kayıtlı Değildir`);
        return;
      }
    }



    if (this.isLoading == false && this.aracTakipKontrol) {
      this.isLoading = true;
      var result = await this.ds.post(`${this.url}/kantar/hafriyatkabul/KabulBelgesi`, { AracId: this.formData.AracId, FirmaId: null, SahaId: sahaId, UserId: this.user.userid, BelgeNo: this.formData.BelgeNo, BarkodNo: this.formData.BarkodNo, DepolamaAlanId: this.kantarConfig.depolamaAlanId, Tonaj: this.formData.Tonaj, Dara: this.formData.Dara, GirisCikis: 'Giriş', isOffline: this.formData.IsOffline, IslemTarihi: new Date() });
      this.isLoading = false;
      if (result.success) {
        if (this._electronService.ipcRenderer) {
          console.log("Bariyer Açma Komutu")
          this._electronService.ipcRenderer.send('bariyer');
        }
        if (this.barkodTuru != "Kamu Fiş") {
          this.responseToPrint(result.data);
        }
        this.formData.BarkodNo = '';
        this.barcode = '';
        this.IsOfflineBackUp = this.formData.IsOffline;
        this.formData.IsOffline = this.IsOfflineBackUp;
        this.BindGrid();

      }
      this.initializeFormData();

      // else {
      //   this.formData.AracId = null;
      //   this.formData.FirmaAdi = null;
      //   this.formData.Tonaj = 0;
      //   this.formData.BarkodNo = '';
      //   this.formData.BelgeNo = '';
      //   this.formData.BelgeNo = '';

      // }
      this.clearInterval();
    }
  }


  public validations(): string {

    var s = '';
    if (this.formData.AracId == null) s = 'Lütfen plaka seçin.';
    else if (this.formData.FirmaAdi == null) s = 'Firma Adı bulunamadı.';
    else if (this.formData.BelgeNo == null || this.formData.BelgeNo == '') s = 'Barkod Okutunuz.';
    else if (this.formData.Dara == null || this.formData.Dara < 1) s = 'Dara bulunamadı.';
    else if (this.formData.Tonaj == null || this.formData.Tonaj < 1) {
      if (this.kantarConfig.kantar) {
        s = 'Tonaj bulunamadı.';
      }
    }
    else if (this.formData.Tonaj < this.formData.Dara) {
      if (this.kantarConfig.kantar) {
        s = 'Dara Tonajdan büyük olamaz.';
      }
    }
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

  onPLakaFilter(keyword) {
    if (DashboardComponent.componentInstance.ddPlakaBelgeFilter.length > 0) {
      this.f_list = DashboardComponent.componentInstance.ddPlakaBelgeFilter.filter((x) => x[this.displayField].includes(keyword.toUpperCase()));
    }
    else {
      this.f_list = this.list.filter((x) => x[this.displayField].includes(keyword.toUpperCase()));
    }

  }
}
