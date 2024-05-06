import { AfterViewInit, Component, ContentChild, ContentChildren, ElementRef, EventEmitter, Input, OnInit, Output, ViewChild } from '@angular/core';
import { Router } from '@angular/router';
import { Button } from '@progress/kendo-angular-buttons';
import { GridComponent } from '@progress/kendo-angular-grid';
import { ButtonType } from '../../../../service/datasource';


@Component({
  selector: 'app-button',
  templateUrl: './button.component.html',
  styleUrls: ['./button.component.scss']
})
export class ButtonComponent implements OnInit {

  @Input() public isdisabled?: boolean;
  @Input() public text?: string;
  @Input() public buttonType?: ButtonType;
  @Input() public class?: string;
  @Input() public icon?: string;
  @Input() public condition?: boolean;
  public isdisabledbool?: boolean

  @Output() public onclick: EventEmitter<void> = new EventEmitter();
  router: Router;

  constructor(private rout: Router) {
    this.router = rout;
  }
  ngOnInit() {
    this.condition = true;
    if (this.buttonType === ButtonType.Yeni) {
      this.text = (this.text === undefined) ? 'Yeni' : this.text;
      this.class = (this.class === undefined) ? 'btn-primary' : this.class;
      this.icon = (this.icon === undefined) ? 'far fa-file' : this.icon;
    }
    else if (this.buttonType === ButtonType.Duzenle) {
      this.text = (this.text === undefined) ? 'Düzenle' : this.text;
      this.class = (this.class === undefined) ? 'btn-success' : this.class;
      this.icon = (this.icon === undefined) ? 'far fa-edit' : this.icon;
    }
    else if (this.buttonType === ButtonType.Sil) {
      this.text = (this.text === undefined) ? 'Sil' : this.text;
      this.class = (this.class === undefined) ? 'btn-danger' : this.class;
      this.icon = (this.icon === undefined) ? 'fas fa-trash' : this.icon;
    }
    else if (this.buttonType === ButtonType.Excel) {
      this.text = (this.text === undefined) ? 'Excel' : this.text;
      this.class = (this.class === undefined) ? 'btn-info' : this.class;
    }
    else if (this.buttonType === ButtonType.Pdf) {
      this.text = (this.text === undefined) ? 'Pdf' : this.text;
      this.class = (this.class === undefined) ? 'btn-info' : this.class;
      this.icon = (this.icon === undefined) ? 'fas fa-file-pdf' : this.icon;
    }
    else if (this.buttonType === ButtonType.Kaydet) {
      this.text = (this.text === undefined) ? 'Kaydet' : this.text;
      this.class = (this.class === undefined) ? 'btn-success' : this.class;
      this.icon = (this.icon === undefined) ? 'fas fa-save' : this.icon;
    }
    else if (this.buttonType === ButtonType.Kapat) {
      this.text = (this.text === undefined) ? 'Kapat' : this.text;
      this.class = (this.class === undefined) ? 'btn-danger' : this.class;
      this.icon = (this.icon === undefined) ? 'fas fa-folder' : this.icon;
    }
    else if (this.buttonType === ButtonType.Dogrula) {
      this.text = (this.text === undefined) ? 'Doğrula' : this.text;
      this.class = (this.class === undefined) ? 'btn-secondary' : this.class;
      this.icon = (this.icon === undefined) ? 'fas fa-check' : this.icon;
    }
    else if (this.buttonType === ButtonType.Ara) {
      this.text = (this.text === undefined) ? 'Bul' : this.text;
      this.class = (this.class === undefined) ? 'btn-secondary' : this.class;
      this.icon = (this.icon === undefined) ? 'fas fa-search' : this.icon;
    }
  }
}

