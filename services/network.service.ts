/**
 * Network Service
 * Checks internet connectivity for cloud sync
 */
class NetworkService {
  private lastCheckTime: number = 0;
  private lastCheckResult: boolean = false;
  private readonly CACHE_DURATION = 5000; // 5 seconds cache

  /**
   * Check if internet is available
   * Uses cached result if checked recently to avoid excessive checks
   */
  async checkConnection(): Promise<boolean> {
    const now = Date.now();
    
    // Return cached result if checked recently
    if (now - this.lastCheckTime < this.CACHE_DURATION) {
      return this.lastCheckResult;
    }

    try {
      // Try to fetch a small resource to verify connectivity
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      
      const response = await fetch('https://www.google.com/generate_204', {
        method: 'HEAD',
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      
      this.lastCheckResult = response.ok;
      this.lastCheckTime = now;
      return this.lastCheckResult;
    } catch (error) {
      this.lastCheckResult = false;
      this.lastCheckTime = now;
      return false;
    }
  }

  /**
   * Get last known connection status (from cache)
   */
  getLastKnownStatus(): boolean {
    return this.lastCheckResult;
  }

  /**
   * Clear the cache to force a fresh check on next call
   */
  clearCache(): void {
    this.lastCheckTime = 0;
  }
}

export const networkService = new NetworkService();
