import React from 'react';
import ReactDOM from 'react-dom/client';
import esriConfig from '@arcgis/core/config';
import App from './App';

// Configure ArcGIS assets path - must match installed @arcgis/core version
esriConfig.assetsPath = 'https://js.arcgis.com/4.34/@arcgis/core/assets';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
