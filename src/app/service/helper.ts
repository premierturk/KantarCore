import { Injectable } from '@angular/core';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { DialogService } from '@progress/kendo-angular-dialog';

@Injectable({
  providedIn: 'root'
})
class Helper {
  dialogService: any;

  constructor(
    private dService: DialogService
  ) {
    this.dialogService = dService;
  }

  openModal(modalService: NgbModal, content: any, size: any = "lg") {

    const modalRef = modalService.open(content, {
      size: size,
      backdrop: 'static',
      windowClass: 'animated slideInDown',
      centered: false,
    });
    return modalRef;
  }


}

export default Helper;
