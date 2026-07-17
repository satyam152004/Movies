import {BrowserSession} from './BrowserSession';
import {ClickRecord} from '../models/Session';

export class ClickHistory {
  private readonly cooldownMs = 15000; // 15s cooldown

  public isClickAllowed(
    session: BrowserSession,
    selector: string,
    text: string,
    fingerprint: string,
  ): boolean {
    const history = session.data.clickHistory;
    const now = Date.now();

    // Check if same selector/text was clicked recently
    const recentClick = history.find(click => {
      const isSameButton =
        click.selector === selector || (click.text === text && text.length > 0);
      const isWithinCooldown = now - click.timestamp < this.cooldownMs;
      return isSameButton && isWithinCooldown;
    });

    if (recentClick) {
      session.addWarning(
        `Cooldown active: Blocked duplicate click on button "${text}"`,
      );
      return false;
    }

    // Loop protection: Check if we have clicked the exact same fingerprint too many times
    const fingerprintClicks = history.filter(
      click => click.fingerprint === fingerprint,
    );
    if (fingerprintClicks.length >= 3) {
      session.addWarning(
        `Loop protection: Fingerprint "${fingerprint}" has already been clicked ${fingerprintClicks.length} times`,
      );
      return false;
    }

    return true;
  }

  public registerClick(
    session: BrowserSession,
    selector: string,
    text: string,
    fingerprint: string,
    xpath = '',
  ): void {
    const record: Omit<ClickRecord, 'clickCount'> = {
      url: session.data.currentUrl,
      xpath,
      selector,
      text,
      fingerprint,
      timestamp: Date.now(),
      stateBeforeClick: session.data.currentState,
    };
    session.addClickRecord(record);
  }
}
