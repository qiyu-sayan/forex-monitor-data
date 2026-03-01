const axios = require('axios');
const fs = require('fs');
const path = require('path');

// 配置
const CONFIG = {
  currencyPairs: ['EUR/USD'],
  wechatWebhook: process.env.WECHAT_WEBHOOK || '',
  strategy: {
    rsiPeriod: 14,
    rsiOverbought: 70,
    rsiOversold: 30,
    maShortPeriod: 10,
    maLongPeriod: 30
  }
};

// 数据目录
const dataDir = path.join(__dirname, '../data');
const historyFile = path.join(dataDir, 'history.json');
const signalsFile = path.join(dataDir, 'signals.json');

// 确保目录存在
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

class ForexTrader {
  constructor() {
    this.history = this.loadHistory();
    this.signals = this.loadSignals();
  }

  loadHistory() {
    try {
      if (fs.existsSync(historyFile)) {
        const data = JSON.parse(fs.readFileSync(historyFile, 'utf8'));
        console.log(`📊 加载历史数据: ${Object.keys(data.data || {}).length} 个货币对`);
        return data;
      }
    } catch (error) {
      console.error('❌ 加载历史数据失败:', error.message);
    }
    return { updates: [], data: {} };
  }

  loadSignals() {
    try {
      if (fs.existsSync(signalsFile)) {
        const data = JSON.parse(fs.readFileSync(signalsFile, 'utf8'));
        console.log(`📨 加载交易信号: ${data.signals?.length || 0} 个信号`);
        return data;
      }
    } catch (error) {
      console.error('❌ 加载交易信号失败:', error.message);
    }
    return { signals: [] };
  }

  async fetchForexData() {
    console.log('🔄 获取外汇数据...');
    
    const results = {};
    const timestamp = new Date().toISOString();
    
    try {
      // 使用Frankfurter API
      const response = await axios.get('https://api.frankfurter.app/latest', {
        params: { from: 'EUR', to: 'USD' },
        timeout: 10000
      });
      
      const rate = response.data.rates.USD;
      console.log(`✅ EUR/USD: ${rate}`);
      
      results['EUR/USD'] = {
        rate,
        timestamp,
        high: rate,
        low: rate,
        change: 0
      };
      
      this.saveDataPoint('EUR/USD', rate, timestamp);
      
    } catch (error) {
      console.error('❌ API请求失败:', error.message);
      
      // 使用历史数据
      if (this.history.data['EUR/USD']?.length > 0) {
        const lastData = this.history.data['EUR/USD'][this.history.data['EUR/USD'].length - 1];
        results['EUR/USD'] = {
          rate: lastData.rate,
          timestamp: lastData.timestamp,
          high: lastData.rate,
          low: lastData.rate,
          change: 0
        };
        console.log(`📊 使用历史数据: ${lastData.rate}`);
      } else {
        console.log('⚠️ 无可用数据');
        return null;
      }
    }
    
    return results;
  }

  saveDataPoint(pair, rate, timestamp) {
    if (!this.history.data[pair]) {
      this.history.data[pair] = [];
    }
    
    this.history.data[pair].push({ rate, timestamp });
    
    // 限制数据量
    if (this.history.data[pair].length > 1000) {
      this.history.data[pair] = this.history.data[pair].slice(-1000);
    }
    
    this.history.updates.push({ pair, rate, timestamp });
    
    // 保存文件
    fs.writeFileSync(historyFile, JSON.stringify(this.history, null, 2));
  }

  calculateRSI(prices, period = 14) {
    if (prices.length < period + 1) return 50;
    
    let gains = 0;
    let losses = 0;
    
    for (let i = 1; i <= period; i++) {
      const change = prices[prices.length - i] - prices[prices.length - i - 1];
      if (change > 0) gains += change;
      else losses -= change;
    }
    
    const avgGain = gains / period;
    const avgLoss = losses / period;
    
    if (avgLoss === 0) return 100;
    const rs = avgGain / avgLoss;
    return 100 - (100 / (1 + rs));
  }

  calculateMA(prices, period) {
    if (prices.length < period) return 0;
    const slice = prices.slice(-period);
    return slice.reduce((a, b) => a + b, 0) / slice.length;
  }

  analyzeStrategy(pair, currentRate, historyData) {
    if (!historyData || historyData.length < CONFIG.strategy.maLongPeriod) {
      return { 
        signal: 'HOLD', 
        reason: '数据不足，继续观察',
        indicators: {
          rsi: 'N/A',
          maShort: 'N/A',
          maLong: 'N/A',
          currentRate: currentRate.toFixed(4)
        }
      };
    }
    
    const prices = historyData.map(d => d.rate);
    const rsi = this.calculateRSI(prices, CONFIG.strategy.rsiPeriod);
    const maShort = this.calculateMA(prices, CONFIG.strategy.maShortPeriod);
    const maLong = this.calculateMA(prices, CONFIG.strategy.maLongPeriod);
    
    let signal = 'HOLD';
    let reason = '';
    
    if (rsi < CONFIG.strategy.rsiOversold && currentRate > maShort && maShort > maLong) {
      signal = 'BUY';
      reason = `RSI超卖(${rsi.toFixed(1)})，均线金叉`;
    } else if (rsi > CONFIG.strategy.rsiOverbought && currentRate < maShort && maShort < maLong) {
      signal = 'SELL';
      reason = `RSI超买(${rsi.toFixed(1)})，均线死叉`;
    } else {
      signal = 'HOLD';
      if (rsi < 40 && maShort > maLong) {
        reason = `接近买入条件 (RSI: ${rsi.toFixed(1)})`;
      } else if (rsi > 60 && maShort < maLong) {
        reason = `接近卖出条件 (RSI: ${rsi.toFixed(1)})`;
      } else {
        reason = `中性观望 (RSI: ${rsi.toFixed(1)})`;
      }
    }
    
    return {
      signal,
      reason,
      indicators: {
        rsi: rsi.toFixed(1),
        maShort: maShort.toFixed(4),
        maLong: maLong.toFixed(4),
        currentRate: currentRate.toFixed(4)
      }
    };
  }

  async sendWeChatNotification(signal, pair, indicators, reason) {
    if (!CONFIG.wechatWebhook) {
      console.log('⚠️ 企业微信Webhook未配置');
      return;
    }
    
    // 避免频繁通知
    const lastSignal = this.signals.signals
      .filter(s => s.pair === pair && s.signal === signal)
      .pop();
    
    if (lastSignal) {
      const hoursSinceLast = (new Date() - new Date(lastSignal.timestamp)) / (1000 * 60 * 60);
      if (signal === 'HOLD' && hoursSinceLast < 2) {
        console.log('⏸️ 跳过持仓通知（2小时内已发送）');
        return;
      }
    }
    
    const messageTypes = {
      BUY: '🟢 买入信号',
      SELL: '🔴 卖出信号',
      HOLD: '🟡 持仓建议'
    };
    
    const msgType = signal === 'HOLD' ? 'text' : 'markdown';
    const timestamp = new Date().toLocaleString('zh-CN');
    
    let content;
    if (signal === 'HOLD') {
      content = {
        content: `${messageTypes[signal]}\n货币对: ${pair}\n当前价: ${indicators.currentRate}\nRSI: ${indicators.rsi}\n${reason}\n时间: ${timestamp}`
      };
    } else {
      content = {
        content: `## ${messageTypes[signal]}\n**货币对:** ${pair}\n**当前价格:** ${indicators.currentRate}\n**RSI指标:** ${indicators.rsi}\n**短期MA:** ${indicators.maShort}\n**长期MA:** ${indicators.maLong}\n**信号理由:** ${reason}\n**时间:** ${timestamp}`
      };
    }
    
    try {
      await axios.post(CONFIG.wechatWebhook, {
        msgtype: msgType,
        [msgType]: content
      }, { timeout: 5000 });
      
      console.log(`✅ 企业微信通知: ${signal}`);
      
    } catch (error) {
      console.error('❌ 发送通知失败:', error.message);
    }
  }

  saveSignal(signal, pair, indicators, reason) {
    const signalData = {
      timestamp: new Date().toISOString(),
      pair,
      signal,
      indicators,
      reason
    };
    
    this.signals.signals.push(signalData);
    
    if (this.signals.signals.length > 100) {
      this.signals.signals = this.signals.signals.slice(-100);
    }
    
    fs.writeFileSync(signalsFile, JSON.stringify(this.signals, null, 2));
    
    return signalData;
  }

  async run() {
    console.log('🚀 === 外汇自动交易机器人开始运行 ===');
    console.log('⏰ 时间:', new Date().toLocaleString('zh-CN'));
    
    // 1. 获取数据
    const forexData = await this.fetchForexData();
    
    if (!forexData) {
      console.log('❌ 无法获取数据，运行终止');
      return;
    }
    
    // 2. 分析每个货币对
    for (const [pair, data] of Object.entries(forexData)) {
      console.log(`\n📈 分析 ${pair}: ${data.rate}`);
      
      const historyData = this.history.data[pair] || [];
      const analysis = this.analyzeStrategy(pair, data.rate, historyData);
      
      console.log(`📢 信号: ${analysis.signal}`);
      console.log(`📝 理由: ${analysis.reason}`);
      console.log(`📊 指标: RSI=${analysis.indicators.rsi}, MA=${analysis.indicators.maShort}/${analysis.indicators.maLong}`);
      
      // 保存信号
      this.saveSignal(
        analysis.signal,
        pair,
        analysis.indicators,
        analysis.reason
      );
      
      // 发送通知
      await this.sendWeChatNotification(
        analysis.signal,
        pair,
        analysis.indicators,
        analysis.reason
      );
    }
    
    console.log('\n✅ === 运行完成 ===');
    console.log('📁 数据保存到:', dataDir);
  }
}

// 主函数
async function main() {
  try {
    const trader = new ForexTrader();
    await trader.run();
  } catch (error) {
    console.error('❌ 程序出错:', error);
    process.exit(1);
  }
}

// 执行
main();