import {BaseStrategy} from '../strategies/BaseStrategy';
import {HubCloudStrategy} from '../strategies/HubCloudStrategy';
import {InventoryIdeaStrategy} from '../strategies/InventoryIdeaStrategy';
import {PixelDrainStrategy} from '../strategies/PixelDrainStrategy';
import {DirectDownloadStrategy} from '../strategies/DirectDownloadStrategy';

export class StrategyRegistry {
  private static instance: StrategyRegistry;
  private strategies: BaseStrategy[] = [];
  private fallbackStrategy: BaseStrategy;

  private constructor() {
    this.strategies = [
      new HubCloudStrategy(),
      new InventoryIdeaStrategy(),
      new PixelDrainStrategy(),
    ];
    this.fallbackStrategy = new DirectDownloadStrategy();
  }

  public static getInstance(): StrategyRegistry {
    if (!StrategyRegistry.instance) {
      StrategyRegistry.instance = new StrategyRegistry();
    }
    return StrategyRegistry.instance;
  }

  public register(strategy: BaseStrategy): void {
    this.strategies.unshift(strategy);
  }

  public resolve(url: string): BaseStrategy {
    for (const strategy of this.strategies) {
      if (strategy.supports(url)) {
        return strategy;
      }
    }
    return this.fallbackStrategy;
  }
}
