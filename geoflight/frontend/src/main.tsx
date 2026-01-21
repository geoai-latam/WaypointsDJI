import React from 'react';
import ReactDOM from 'react-dom/client';
import esriConfig from '@arcgis/core/config';
import App from './App';

// Configure ArcGIS assets path for version 4.31
esriConfig.assetsPath = 'https://js.arcgis.com/4.31/@arcgis/core/assets';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
