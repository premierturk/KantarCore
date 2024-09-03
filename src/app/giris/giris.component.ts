import { Component, isDevMode } from '@angular/core';
import { Router } from '@angular/router';
import { DataSource } from '../service/datasource';
import { GradientConfig } from '../app-config';
import httpClient from '../service/http-client';
import { KantarConfig } from '../helper/kantar-config';

@Component({
  selector: 'app-giris',
  templateUrl: './giris.component.html',
  styleUrls: ['./giris.component.scss']
})
export class GirisComponent {
  public gradientConfig: any;
  public remember: boolean = false;

  constructor(
    public ds: DataSource,
    private router: Router,
    public kantarConfig: KantarConfig
  ) {
    this.gradientConfig = GradientConfig.config;
  }

  private getLoginInfo() {
    var info = window.localStorage.getItem("login");
    if (info != null) {
      this.formData = JSON.parse(info);
      this.remember = true;
    }
  };




  ngOnInit() {
    this.getLoginInfo();
  }



  private url: string = this.kantarConfig.serviceUrl;
  isLoading: boolean = false;
  public logoSrc: string = this.kantarConfig.logoUrl;
  public formData: any = {
    username: '',
    password: '',
    isMobile: false
  };

  async giris() {
    this.isLoading = true;
    const result = await this.ds.login(`${this.url}/User/CheckUser`, `grant_type=password&username=${this.formData.username}&password=${this.formData.password}`);
    this.isLoading = false;
    if (![null, undefined, "null"].includes(result.authtoken)) {
      window.localStorage.setItem('user', JSON.stringify(result));
      if (this.remember) window.localStorage.setItem("login", JSON.stringify(this.formData));
      else window.localStorage.removeItem("login");
      httpClient.defaults.headers.common.Authorization = `Bearer ${result.authtoken}`;
      this.router.navigate(["/dashboard"]);
    }
  }
}
