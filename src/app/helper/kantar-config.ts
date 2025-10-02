import { Injectable, isDevMode } from '@angular/core';

@Injectable({
    providedIn: 'root',
})
export class KantarConfig {
    kantarAdi: string;
    depolamaAlanId: number;
    url: string;
    logoUrl: string;
    serviceUrl: string;
    isPrinterOn: boolean;
    barkodOkuyucu: boolean;
    printerName: string;
    kantar: boolean;
    kantarMarka: string;
    serialPort: SerialPort;

    constructor() {
        var config = JSON.parse(localStorage.getItem("kantarConfig"));
        for (const [key, value] of Object.entries(config)) {
            if (key != "serialPort") this[key] = value;
            else this[key] = new SerialPort(value);
        }
        this.logoUrl = this.url + "/HYS/img/logo/logo.png";

        // this.serviceUrl = isDevMode() ? "/api" : `${this.url}/HYS.WebApi/api`;
        this.serviceUrl = isDevMode() ? "/api" : `${this.url}/HYS.WebApi/api`;
        console.log(this.serviceUrl);
    }
}


class SerialPort {
    path: string;
    baudRate: number;
    dataBits: number;
    parity: string;
    constructor(_config) {
        for (const [key, value] of Object.entries(_config)) this[key] = value;
    }
}