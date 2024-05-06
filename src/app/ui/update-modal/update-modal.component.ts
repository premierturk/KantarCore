import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { LabelSettings, ProgressBarAnimation } from '@progress/kendo-angular-progressbar';
import { ElectronService } from 'ngx-electron';
import { ButtonType } from 'src/app/service/datasource';

@Component({
  selector: 'app-update-modal',
  templateUrl: './update-modal.component.html',
  styleUrls: ['./update-modal.component.scss']
})
export class UpdateModalComponent implements OnInit {
  static componentInstance: any;
  constructor(
    private _electronService: ElectronService,
    public activeModal: NgbActiveModal,
    private ref: ChangeDetectorRef,) {
    UpdateModalComponent.componentInstance = this;
    if (this._electronService.ipcRenderer) {
      this._electronService.ipcRenderer.on('download_progress', this.downloadProgress);
      this._electronService.ipcRenderer.on('update_downloaded', this.updateFinished);
    }
  }
  public ButtonType = ButtonType;
  public percent: number = 0.00;
  public speed: number = 0.00;
  public animation: ProgressBarAnimation = { duration: 2000 }
  public finished: boolean = false;

  public label: LabelSettings = {
    format: (value: number): string => {
      return `%${value.toFixed(2)}`;
    },
    position: "center",
  };
  downloadProgress(event, data) {
    const component = UpdateModalComponent.componentInstance;
    component.percent = data.data.percent;
    component.speed = (data.data.bytesPerSecond / 1000000).toFixed(2);
    component.ref.detectChanges();
  }
  updateFinished(event, data) {
    const component = UpdateModalComponent.componentInstance;
    console.log("FINISHED");
    component.finished = true;
    component.ref.detectChanges();

  }
  update() {

    this._electronService.ipcRenderer.send("restart_update");
  }
  ngOnInit(): void {
  }

}
