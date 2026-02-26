try {
    await import('./api-server.js');
    console.log('✅ API Server started successfully');
} catch (err) {
    console.error('❌ API Server FAILED to start:');
    console.error(err);
    if (err.stack) console.error(err.stack);
}
