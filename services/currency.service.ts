import AsyncStorage from '@react-native-async-storage/async-storage';

export interface Currency {
  code: string;
  symbol: string;
  name: string;
}

export const CURRENCIES: Currency[] = [
  { code: 'MXN', symbol: '$', name: 'Mexican Peso' },
  { code: 'USD', symbol: '$', name: 'US Dollar' },
  { code: 'EUR', symbol: '€', name: 'Euro' },
  { code: 'GBP', symbol: '£', name: 'British Pound' },
  { code: 'THB', symbol: '฿', name: 'Thai Baht' },
  { code: 'JPY', symbol: '¥', name: 'Japanese Yen' },
];

class CurrencyService {
  private static instance: CurrencyService;
  private currentCurrency: Currency = CURRENCIES[0]; // Default to USD
  private listeners: Array<(currency: Currency) => void> = [];

  private constructor() {
    this.loadCurrency();
  }

  static getInstance(): CurrencyService {
    if (!CurrencyService.instance) {
      CurrencyService.instance = new CurrencyService();
    }
    return CurrencyService.instance;
  }

  private async loadCurrency(): Promise<void> {
    try {
      const savedCurrency = await AsyncStorage.getItem('app_currency');
      if (savedCurrency) {
        const currency = CURRENCIES.find(c => c.code === savedCurrency);
        if (currency) {
          this.currentCurrency = currency;
          this.notifyListeners();
        }
      }
    } catch (error) {
      console.error('Error loading currency:', error);
    }
  }

  async setCurrency(currencyCode: string): Promise<void> {
    try {
      const currency = CURRENCIES.find(c => c.code === currencyCode);
      if (currency) {
        this.currentCurrency = currency;
        await AsyncStorage.setItem('app_currency', currencyCode);
        this.notifyListeners();
      }
    } catch (error) {
      console.error('Error setting currency:', error);
    }
  }

  getCurrency(): Currency {
    return this.currentCurrency;
  }

  formatCurrency(amount: number): string {
    return `${this.currentCurrency.symbol}${amount.toFixed(2)}`;
  }

  getCurrencySymbol(): string {
    return this.currentCurrency.symbol;
  }

  subscribe(listener: (currency: Currency) => void): () => void {
    this.listeners.push(listener);
    // Return unsubscribe function
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  private notifyListeners(): void {
    this.listeners.forEach(listener => listener(this.currentCurrency));
  }
}

export const currencyService = CurrencyService.getInstance();
