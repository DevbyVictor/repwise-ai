import('./server.mjs').catch(error => {
  console.error(error.message);
  process.exitCode = 1;
});
