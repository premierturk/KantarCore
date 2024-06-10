import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { ButtonType } from 'src/app/service/datasource';

@Component({
  selector: 'app-saha-secimi',
  templateUrl: './saha-secimi.component.html',
  styles: [
    `
    .list-group-item:hover{
      background-color: #6e8ff9;
      color:white
    }
    `
  ]
})
export class SahaSecimiComponent implements OnInit {
  public ButtonType = ButtonType;

  @Input() list;
  @Output() result: EventEmitter<any> = new EventEmitter();

  constructor(public activeModal: NgbActiveModal) { }

  ngOnInit(): void {
  }


  async okButton(sahaId) {
    this.result.emit(sahaId);
    this.activeModal.close(sahaId);
  }
}
