/**
 * GemLog Performance Test Suite
 * アドオンストア申請前のパフォーマンス検証用
 * 
 * 使い方:
 * 1. Chrome DevToolsのConsoleで実行
 * 2. GemLogをON/OFFそれぞれの状態で実行して比較
 * 3. 結果をスクリーンショットで保存
 */
(function() {
  'use strict';

  const RESULTS = {};

  console.log('========================================');
  console.log('  GemLog Performance Test Suite v1.0');
  console.log('========================================\n');

  // ========== Test 1: Memory Usage ==========
  async function testMemoryUsage() {
    console.log('🧪 Test 1: Memory Usage');
    
    if (performance.memory) {
      const mem = performance.memory;
      RESULTS.memory = {
        usedJSHeapSize: (mem.usedJSHeapSize / 1024 / 1024).toFixed(2) + ' MB',
        totalJSHeapSize: (mem.totalJSHeapSize / 1024 / 1024).toFixed(2) + ' MB',
        jsHeapSizeLimit: (mem.jsHeapSizeLimit / 1024 / 1024).toFixed(2) + ' MB'
      };
      console.log('  Used Heap:', RESULTS.memory.usedJSHeapSize);
      console.log('  Total Heap:', RESULTS.memory.totalJSHeapSize);
    } else {
      console.log('  ⚠️ performance.memory not available (use Chrome with --enable-precise-memory-info)');
    }
  }

  // ========== Test 2: DOM Mutation Observer Impact ==========
  async function testObserverImpact() {
    console.log('\n🧪 Test 2: MutationObserver Impact');
    
    const chatContainer = document.querySelector('infinite-scroller.chat-history');
    if (!chatContainer) {
      console.log('  ⚠️ Chat container not found. Run this test on gemini.google.com');
      return;
    }

    // 100個のダミー要素を追加して、Observerの反応時間を計測
    const iterations = 100;
    const times = [];

    for (let i = 0; i < iterations; i++) {
      const div = document.createElement('div');
      div.className = 'perf-test-node';
      div.textContent = 'test';
      
      const start = performance.now();
      chatContainer.appendChild(div);
      await new Promise(r => requestAnimationFrame(r));
      times.push(performance.now() - start);
    }

    // クリーンアップ
    chatContainer.querySelectorAll('.perf-test-node').forEach(n => n.remove());

    const avg = times.reduce((a, b) => a + b, 0) / times.length;
    const max = Math.max(...times);
    const min = Math.min(...times);

    RESULTS.observerImpact = {
      avgTime: avg.toFixed(3) + ' ms',
      maxTime: max.toFixed(3) + ' ms',
      minTime: min.toFixed(3) + ' ms',
      iterations
    };

    console.log(`  Average mutation response: ${avg.toFixed(3)} ms`);
    console.log(`  Max: ${max.toFixed(3)} ms, Min: ${min.toFixed(3)} ms`);
    console.log(`  ${avg < 1 ? '✅ PASS' : avg < 5 ? '⚠️ ACCEPTABLE' : '❌ FAIL'} (target: <1ms)`);
  }

  // ========== Test 3: Storage Read/Write Performance ==========
  async function testStoragePerformance() {
    console.log('\n🧪 Test 3: Storage Read/Write Performance');

    // Write test
    const testData = {
      id: 'perf_test_' + Date.now(),
      title: 'Performance Test Chat',
      messages: Array.from({length: 50}, (_, i) => ({
        turnId: 'turn_' + i,
        role: i % 2 === 0 ? 'user' : 'model',
        content: 'Test message content '.repeat(20), // ~400 chars each
        timestamp: new Date().toISOString()
      }))
    };

    const testKey = 'gemlog_perf_test';

    // Write
    const writeStart = performance.now();
    await chrome.storage.local.set({ [testKey]: testData });
    const writeTime = performance.now() - writeStart;

    // Read
    const readStart = performance.now();
    await chrome.storage.local.get(testKey);
    const readTime = performance.now() - readStart;

    // Cleanup
    await chrome.storage.local.remove(testKey);

    const dataSizeKB = (JSON.stringify(testData).length / 1024).toFixed(1);

    RESULTS.storage = {
      writeTime: writeTime.toFixed(2) + ' ms',
      readTime: readTime.toFixed(2) + ' ms',
      dataSize: dataSizeKB + ' KB',
      messages: testData.messages.length
    };

    console.log(`  Data size: ${dataSizeKB} KB (${testData.messages.length} messages)`);
    console.log(`  Write: ${writeTime.toFixed(2)} ms`);
    console.log(`  Read: ${readTime.toFixed(2)} ms`);
    console.log(`  ${writeTime < 50 ? '✅ PASS' : '⚠️ SLOW'} (target: <50ms)`);
  }

  // ========== Test 4: Page Responsiveness ==========
  async function testPageResponsiveness() {
    console.log('\n🧪 Test 4: Page Responsiveness (Long Task Detection)');

    let longTasks = 0;

    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (entry.duration > 50) {
          longTasks++;
        }
      }
    });

    try {
      observer.observe({ entryTypes: ['longtask'] });
    } catch {
      console.log('  ⚠️ Long Task API not available');
      return;
    }

    // 3秒間観測
    console.log('  Observing for 3 seconds...');
    await new Promise(r => setTimeout(r, 3000));
    observer.disconnect();

    RESULTS.responsiveness = {
      longTasks,
      status: longTasks === 0 ? 'EXCELLENT' : longTasks < 3 ? 'GOOD' : 'NEEDS ATTENTION'
    };

    console.log(`  Long tasks detected: ${longTasks}`);
    console.log(`  ${longTasks === 0 ? '✅' : longTasks < 3 ? '⚠️' : '❌'} ${RESULTS.responsiveness.status}`);
  }

  // ========== Test 5: Extension Storage Usage ==========
  async function testStorageUsage() {
    console.log('\n🧪 Test 5: Extension Storage Usage');

    try {
      const bytes = await new Promise(r => chrome.storage.local.getBytesInUse(null, r));
      const mb = (bytes / 1024 / 1024).toFixed(2);

      RESULTS.storageUsage = {
        totalBytes: bytes,
        totalMB: mb + ' MB'
      };

      console.log(`  Total storage used: ${mb} MB (${bytes.toLocaleString()} bytes)`);
      console.log(`  ${bytes < 10 * 1024 * 1024 ? '✅ PASS' : '⚠️ LARGE'} (target: <10MB)`);
    } catch {
      console.log('  ⚠️ Cannot access chrome.storage (run from extension context)');
    }
  }

  // ========== Run All Tests ==========
  async function runAll() {
    const start = performance.now();

    await testMemoryUsage();
    await testObserverImpact();
    await testStoragePerformance();
    await testPageResponsiveness();
    await testStorageUsage();

    const totalTime = ((performance.now() - start) / 1000).toFixed(1);

    console.log('\n========================================');
    console.log('  SUMMARY');
    console.log('========================================');
    console.log(`  Total test time: ${totalTime}s`);
    console.log('  Results:', JSON.stringify(RESULTS, null, 2));
    console.log('\n💡 Tip: Run this test with GemLog disabled,');
    console.log('   then with GemLog enabled, and compare results.');
    console.log('========================================');

    return RESULTS;
  }

  // 自動実行
  runAll().then(results => {
    window.__gemlog_perf_results = results;
    console.log('\n📊 Results saved to window.__gemlog_perf_results');
  });
})();
