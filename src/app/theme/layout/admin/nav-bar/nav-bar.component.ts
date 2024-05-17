import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { GradientConfig } from '../../../../app-config';
import { KantarConfig } from 'src/app/helper/kantar-config';

@Component({
  selector: 'app-nav-bar',
  templateUrl: './nav-bar.component.html',
  styleUrls: ['./nav-bar.component.scss']
})
export class NavBarComponent implements OnInit {
  public gradientConfig: any;
  public menuClass: boolean;
  public collapseStyle: string;
  public windowWidth: number;
  public logoSrc: string = this.kantarConfig.logoUrl;

  @Output() onNavCollapse = new EventEmitter();
  @Output() onNavHeaderMobCollapse = new EventEmitter();

  constructor(public kantarConfig: KantarConfig) {
    this.gradientConfig = GradientConfig.config;
    this.menuClass = false;
    this.collapseStyle = 'none';
    this.windowWidth = window.innerWidth;
  }

  ngOnInit() { }

  toggleMobOption() {
    this.menuClass = !this.menuClass;
    this.collapseStyle = (this.menuClass) ? 'block' : 'none';
  }

  navCollapse() {
    if (this.windowWidth >= 992) {
      this.onNavCollapse.emit();
    } else {
      this.onNavHeaderMobCollapse.emit();
    }
  }

}
