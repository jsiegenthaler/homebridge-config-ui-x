import {
  Component,
  ElementRef,
  OnInit,
  ViewChild,
} from '@angular/core';
import { Router } from '@angular/router';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { TranslateService } from '@ngx-translate/core';
import { throttleTime } from 'rxjs/operators';
import { lt } from 'semver';
import { AuthService } from '@/app/core/auth/auth.service';
import { BackupRestoreComponent } from '@/app/core/backup-restore/backup-restore.component';
import { ConfirmComponent } from '@/app/core/components/confirm/confirm.component';
import { ManagePluginsService } from '@/app/core/manage-plugins/manage-plugins.service';
import { NotificationService } from '@/app/core/notification.service';
import { SettingsService } from '@/app/core/settings.service';
import { WsService } from '@/app/core/ws.service';
import { RestartModalComponent } from '@/app/shared/layout/restart-modal/restart-modal.component';
import { environment } from '@/environments/environment';

@Component({
  selector: 'app-layout',
  templateUrl: './layout.component.html',
  styleUrls: ['./layout.component.scss'],
})
export class LayoutComponent implements OnInit {
  @ViewChild('restartHomebridgeIcon') restartHomebridgeIcon: ElementRef;

  public rPiCurrentlyUnderVoltage = false;
  public rPiWasUnderVoltage = false;

  private io = this.$ws.connectToNamespace('app');

  constructor(
    public translate: TranslateService,
    private $ws: WsService,
    public $auth: AuthService,
    public $settings: SettingsService,
    private $plugins: ManagePluginsService,
    private $notification: NotificationService,
    private $modal: NgbModal,
    private $router: Router,
  ) {}

  ngOnInit() {
    this.io.socket.on('reconnect', () => {
      this.$auth.checkToken();
    });

    this.$notification.configUpdated.pipe(throttleTime(15000)).subscribe(() => {
      // highlight the homebridge restart icon
      const element = (this.restartHomebridgeIcon.nativeElement as HTMLElement);
      element.classList.add('fa-beat');
      setTimeout(() => {
        element.classList.remove('fa-beat');
      }, 14900);
    });

    this.$notification.restartTriggered.subscribe(() => {
      // ensure restart icon is not highlighted when restart is triggered
      const element = (this.restartHomebridgeIcon?.nativeElement as HTMLElement);
      if (element) {
        element.classList.remove('fa-beat');
      }
    });

    this.$notification.raspberryPiThrottled.subscribe((throttled) => {
      if (throttled['Under-voltage detected']) {
        this.rPiCurrentlyUnderVoltage = true;
      }
      if (throttled['Under-voltage has occurred']) {
        this.rPiWasUnderVoltage = true;
      }
    });

    this.compareServerUiVersion();
  }

  backupRestoreHomebridge() {
    this.$modal.open(BackupRestoreComponent, {
      size: 'lg',
      backdrop: 'static',
    });
  }

  openUiSettings() {
    this.$plugins.settings({
      name: 'homebridge-config-ui-x',
      displayName: 'Homebridge UI',
      settingsSchema: true,
      links: {},
    });
  }

  openRestartModal() {
    this.$modal.open(RestartModalComponent);
  }

  async compareServerUiVersion() {
    if (!this.$settings.settingsLoaded) {
      await this.$settings.onSettingsLoaded.toPromise();
    }

    if (lt(this.$settings.uiVersion, environment.serverTarget)) {
      console.log(`Server restart required. UI Version: ${environment.serverTarget} - Server Version: ${this.$settings.uiVersion} `);
      const ref = this.$modal.open(ConfirmComponent);

      ref.componentInstance.title = this.translate.instant('platform.version.title_service_restart_required');
      ref.componentInstance.message = this.translate.instant('platform.version.message_service_restart_required', {
        serverVersion: this.$settings.uiVersion,
        uiVersion: environment.serverTarget,
      });
      ref.componentInstance.confirmButtonLabel = this.translate.instant('menu.tooltip_restart');
      ref.componentInstance.faIconClass = 'fas fa-fw-power-off';

      ref.result.then(() => {
        this.$router.navigate(['/restart']);
      }).catch(() => {
        // do nothing
      });
    }
  }
}
