import { useState, useEffect } from 'react';
import { currencyService, Currency } from '../services/currency.service';

export function useCurrency() {
  const [currency, setCurrency] = useState<Currency>(currencyService.getCurrency());

  useEffect(() => {
    // Subscribe to currency changes
    const unsubscribe = currencyService.subscribe((newCurrency) => {
      setCurrency(newCurrency);
    });

    // Load initial currency
    setCurrency(currencyService.getCurrency());

    return unsubscribe;
  }, []);

  const formatCurrency = (amount: number): string => {
    return currencyService.formatCurrency(amount);
  };

  const getCurrencySymbol = (): string => {
    return currencyService.getCurrencySymbol();
  };

  return {
    currency,
    formatCurrency,
    getCurrencySymbol,
  };
}
