import { Injectable } from '@angular/core';
import httpClient from '../service/http-client';
import { DialogService } from '@progress/kendo-angular-dialog';
import { GradientConfig } from '../app-config';
import * as Notiflix from 'node_modules/notiflix/dist/notiflix-3.2.6.min.js';
import { Router } from '@angular/router';
import { AppNetworkStatus } from '../network-status';
import * as moment from 'moment';

@Injectable({
  providedIn: 'root',
})
export class DataSource {
  public gradientConfig: any;
  router: Router;
  public loading: boolean;

  constructor(private dialogService: DialogService, private rout: Router) {
    this.gradientConfig = GradientConfig.config;
    this.router = rout;
    Notiflix.Notify.init({
      showOnlyTheLastOne: true,
    });
  }

  async login(url: string, data: any) {
    try {
      const resp = await httpClient.post(url, data);
      if (resp.status == 200) {
        Notiflix.Notify.success('Hoşgeldiniz');
      } else {
        Notiflix.Notify.failure('Hata oluştu');
      }

      return resp.data;
    } catch (err) {
      this.handleErrorResponse(err);
      return err;
    }
  }

  async get(url: string) {
    const localStorageName = url.split("?")[0].split("/").pop();
    if (AppNetworkStatus.isOffline) return JSON.parse(window.localStorage.getItem(localStorageName));
    try {
      const resp = await httpClient.get(url);

      if (resp.status == 200) {
        window.localStorage.setItem(localStorageName, JSON.stringify(resp.data));
      } else {
        Notiflix.Notify.failure(resp.data.toString());
      }
      return resp.data;
    } catch (err) {
      this.handleErrorResponse(err);
      return err;
    }
  }

  // async getNoMess(url: string) {
  //   try {
  //     const resp = await httpClient.get(url);
  //     return resp.data;
  //   } catch (err) {
  //     return err;
  //   }
  // }

  async post(url: string, data: any) {
    if (AppNetworkStatus.isOffline) return this.offlinePost(url, data);
    try {
      var success = false;
      const resp = await httpClient.post(url, data);
      if (resp.status == 200) {
        success = true;
        Notiflix.Notify.success('Başarılı');
      } else {
        Notiflix.Notify.failure(resp.data.toString());
      }
      return { success: success, data: resp.data };
    } catch (err) {
      this.handleErrorResponse(err);
      return { success: false };
    }
  }

  async postNoMess(url: string, data: any) {
    try {
      var success = false;
      const resp = await httpClient.post(url, data);
      if (resp.status == 200) {
        success = true;
      } else {
      }
      return { success: success, data: resp.data };
    } catch (err) {
      return { success: false };
    }
  }

  // async put(url: string, data: any) {
  //   if (AppNetworkStatus.isOffline) return this.offlinePut(url, data);
  //   try {
  //     var success = false;
  //     const resp = await httpClient.put(url, data);
  //     if (resp.status == 200) {
  //       success = true;
  //       Notiflix.Notify.success('Başarılı');
  //     } else {
  //       Notiflix.Notify.failure(resp.data.toString());
  //     }
  //     return { success: success, data: resp.data };
  //   } catch (err) {
  //     this.handleErrorResponse(err);
  //     return { success: false };
  //   }
  // }

  async putNoMess(url: string, data: any) {
    try {
      var success = false;
      const resp = await httpClient.put(url, data);
      if (resp.status == 200) {
        success = true;
      } else {
      }
      return { success: success, data: resp.data };
    } catch (err) {
      return { success: false };
    }
  }

  // async delete(url: string) {
  //   try {
  //     const resp = await httpClient.delete(url);
  //     if (resp.status == 200) {
  //       Notiflix.Notify.success('Başarılı');
  //     } else {
  //       Notiflix.Notify.failure(resp.data.toString());
  //     }

  //     return resp.data;
  //   } catch (err) {
  //     this.handleErrorResponse(err);
  //     return err;
  //   }
  // }

  async offlinePost(url: string, data: any) {
    try {
      //offline requestlere eklenmesi
      var requestList = JSON.parse(window.localStorage.getItem("offlineRequests"));
      if (requestList == null) requestList = [];
      requestList.push({ url: url, data: data, type: "POST" });
      window.localStorage.setItem("offlineRequests", JSON.stringify(requestList));


      if (url.includes("/kantar/hafriyatkabul/KabulBelgesi")) {
        //print işlemi için donulecek data 
        const arac = JSON.parse(window.localStorage.getItem("araclistesi")).find(a => a.AracId == data.AracId);
        const kantarAdi = window.localStorage.getItem("KantarAdi");

        const fisData = {
          KantarAdi: kantarAdi,
          HafriyatDokumId: null,
          BelgeNo: data.BelgeNo,
          PlakaNo: arac.PlakaNo,
          IslemTarihi: moment(new Date()).format("DD.MM.yyyy HH:mm"),
          FirmaAdi: arac.FirmaAdi,
          Dara: arac.Dara,
          Tonaj: data.Tonaj,
          NetTonaj: data.Tonaj - arac.Dara
        };

        //localdeki dokum listesini guncelleme
        var dokumList = JSON.parse(window.localStorage.getItem("GetRaporMulti"));

        if (dokumList.some(dokum => dokum.PlakaNo == arac.PlakaNo && moment(new Date()).diff(dokum.IslemTarihi, 'minutes') < 10)) {
          requestList.pop();
          window.localStorage.setItem("offlineRequests", JSON.stringify(requestList));
          Notiflix.Notify.failure("Tekrarlayan Geçiş.");
          return { success: false, data: {} };
        }

        if (dokumList == null) dokumList = [];
        var fullData = Object.assign(fisData, data);

        requestList[requestList.length - 1].data = fullData;
        window.localStorage.setItem("offlineRequests", JSON.stringify(requestList));

        dokumList.push(fullData);
        dokumList = dokumList.sort(function (a, b) {
          return new Date(b.IslemTarihi).getTime() - new Date(a.IslemTarihi).getTime();
        });
        window.localStorage.setItem("GetRaporMulti", JSON.stringify(dokumList));

        return { success: true, data: fisData };
      } else if (url.includes("kantar/DaraDegisimi")) {
        //localdeki arac listesini guncelleme
        var aracList = JSON.parse(window.localStorage.getItem("araclistesi"));
        var index = aracList.findIndex(a => a.AracId == data.AracId);
        aracList[index].Dara = data.Dara;
        window.localStorage.setItem("araclistesi", JSON.stringify(aracList));
      }

      return { success: true, data: data };
    } catch (error) {
      Notiflix.Notify.failure(error);
      return { success: false };
    }
  }

  // async offlinePut(url: string, data: any) {
  //   try {
  //     //offline requestlere eklenmesi
  //     var requestList = JSON.parse(window.localStorage.getItem("offlineRequests"));
  //     if (requestList == null) requestList = [];
  //     requestList.push({ url: url, data: data, type: "PUT" });
  //     window.localStorage.setItem("offlineRequests", JSON.stringify(requestList));

  //     if (url.includes("api/Kantar")) {
  //       const malzeme = JSON.parse(window.localStorage.getItem("MalzemeTuruList")).find(a => a.MalzemeTuruId == data.MalzemeTipiId);
  //       const tasOcagi = JSON.parse(window.localStorage.getItem("TasOcaklariMini")).find(a => a.TasOcagiId == data.TasOcagiId);
  //       const projeAlani = JSON.parse(window.localStorage.getItem("ProjeAlanlari")).find(a => a.ProjeAlanId == data.ProjeAlaniId);

  //       //localdeki dokum listesini guncelleme
  //       var dokumList = JSON.parse(window.localStorage.getItem("KantarListV4"));
  //       var index = dokumList.findIndex(a => a.TartiNo == data.TartiNo)
  //       dokumList[index].TasOcagiId = data.TasOcagiId;
  //       dokumList[index].GeldigiYer = tasOcagi.Adi;
  //       dokumList[index].ProjeAlaniId = data.ProjeAlaniId;
  //       dokumList[index].GittigiYer = projeAlani.AlanAdi;
  //       dokumList[index].MalzemeTipiId = data.MalzemeTipiId;
  //       dokumList[index].MalzemeAdi = malzeme.MalzemeTuru;
  //       window.localStorage.setItem("KantarListV4", JSON.stringify(dokumList));
  //     }
  //     return { success: true, data: data };
  //   } catch (error) {
  //     Notiflix.Notify.failure(error);
  //     return { success: false };
  //   }


  // }

  handleErrorResponse(error: any) {
    if (error.response && error.response.status) {
      if (error.response.status == '401') {
        this.router.navigate(['giris'], {
          queryParams: { url: window.location.pathname },
        });
        Notiflix.Notify.failure('Lütfen Tekrar Giriş Yapınız');
      } else {
        Notiflix.Notify.failure(error.response.data);

      }
    }
  }
}

export enum ButtonType {
  Yeni,
  Duzenle,
  Sil,
  Excel,
  Pdf,
  Kaydet,
  Kapat,
  Dogrula,
  Ara,
}
