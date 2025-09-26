ymaps.ready(function () {

  // Цвета заливки по округам
  const AO_COLORS = {
    "ЦАО": "#ffcccc",
    "ЮАО": "#ccffcc",
    "САО": "#ccccff",
    "ВАО": "#ffffcc",
    "ЗАО": "#ffd9b3",
    "СВАО": "#e6ccff",
    "СЗАО": "#ccffff",
    "ЮВАО": "#ffcce0",
    "ЮЗАО": "#b3e6b3",
    "НАО": "#f0e68c",
    "ЗелАО": "#f5deb3",
    // возможные полные названия
    "ТРОИЦКИЙ": "#ffe4b5",
    "НОВОМОСКОВСКИЙ": "#dcdcdc",
    "ЗЕЛЕНОГРАДСКИЙ": "#f5deb3",
    "ЦЕНТРАЛЬНЫЙ": "#ffcccc",
    "ЮЖНЫЙ": "#ccffcc",
    "СЕВЕРНЫЙ": "#ccccff",
    "ВОСТОЧНЫЙ": "#ffffcc",
    "ЗАПАДНЫЙ": "#ffd9b3",
    "СЕВЕРО-ВОСТОЧНЫЙ": "#e6ccff",
    "СЕВЕРО-ЗАПАДНЫЙ": "#ccffff",
    "ЮГО-ВОСТОЧНЫЙ": "#ffcce0",
    "ЮГО-ЗАПАДНЫЙ": "#b3e6b3"
  };

  // Ручные координаты для подписей (центр/удобная точка внутри округа)
  const AO_LABEL_COORDS = {
    "ЦАО": [55.752, 37.62],
    "САО": [55.867, 37.536],
    "СВАО": [55.874, 37.68],
    "ВАО": [55.785, 37.82],
    "ЮВАО": [55.70, 37.79],
    "ЮАО": [55.63, 37.64],
    "ЮЗАО": [55.64, 37.49],
    "ЗАО": [55.72, 37.40],
    "СЗАО": [55.81, 37.40],
    "ЗелАО": [55.98, 37.20],
    "НОВОМОСКОВСКИЙ": [55.55, 37.35],
    "ТРОИЦКИЙ": [55.43, 37.28],
    // дубли на случай других ключей
    "ЗЕЛЕНОГРАДСКИЙ": [55.98, 37.20],
    "НАО": [55.55, 37.35]
  };

  // Вставим CSS + переменную для динамического размера шрифта
  const style = document.createElement('style');
  style.textContent = `
    :root { --aoLabelSize: 16px; }
    .ao-label{
      position:relative;
      transform: translate(-50%, -50%);
      pointer-events:none;
      font: 700 var(--aoLabelSize)/1.1 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Arial,sans-serif;
      color:#111;
      text-align:center;
      white-space:nowrap;
      text-shadow:
        0 0 2px #fff, 0 0 6px #fff,
        1px 0 0 #fff, -1px 0 0 #fff, 0 1px 0 #fff, 0 -1px 0 #fff;
    }
  `;
  document.head.appendChild(style);
  const setLabelSize = px => document.documentElement.style.setProperty('--aoLabelSize', px + 'px');

  // Лейаут чистого текста
  const LabelLayout = ymaps.templateLayoutFactory.createClass(
    '<div class="ao-label">$[properties.text]</div>'
  );

  // Хелперы конвертации GeoJSON -> Yandex
  const swapLngLat = p => [p[1], p[0]];
  const convertPolygon = coords => coords.map(contour => contour.map(swapLngLat));
  const convertMultiPolygonToPolygons = coords =>
      coords.map(polygonContours => convertPolygon(polygonContours));

  const myMap = new ymaps.Map("map", {
    center: [55.76, 37.64],
    zoom: 9,
    controls: [
      new ymaps.control.SearchControl({ options: { float: 'right', noPlacemark: true } })
    ]
  });

  ['geolocationControl','trafficControl','fullscreenControl','zoomControl','rulerControl','typeSelector']
    .forEach(ctrl => myMap.controls.remove(ctrl));

  const objectManager = new ymaps.ObjectManager({
    clusterize: true,
    clusterIconLayout: "default#pieChart"
  });

  // Функция подбора размера шрифта от масштаба
  const updateLabelSizeByZoom = () => {
    const z = myMap.getZoom();
    // чем дальше — тем меньше; подберём мягкую шкалу
    let size = 18;
    if (z >= 13) size = 18;
    else if (z >= 12) size = 17;
    else if (z >= 11) size = 16;
    else if (z >= 10) size = 14;
    else if (z >= 9)  size = 13;
    else if (z >= 8)  size = 12;
    else if (z >= 7)  size = 11;
    else size = 10;
    setLabelSize(size);
  };
  updateLabelSizeByZoom();
  myMap.events.add('boundschange', updateLabelSizeByZoom);

  // 1) Границы округов + подписи
  fetch('ao.geojson')
    .then(r => r.json())
    .then(geo => {
      geo.features.forEach(feature => {
        const props = feature.properties || {};
        const abbrev = props.ABBREV;                       // 'ЦАО', 'СВАО', 'ЗелАО'...
        const nameRaw = props.NAME || abbrev || 'АО';
        const colorKey = (abbrev || String(nameRaw).toUpperCase());
        const color = AO_COLORS[colorKey] || "#dddddd";

        const polyProps = { hintContent: nameRaw, balloonContent: nameRaw };
        const polyOpts = {
          fillColor: color,
          fillOpacity: 0.5,                 // плотнее заливка
          strokeColor: "#222",
          strokeWidth: 2,
          strokeOpacity: 0.95,
          zIndex: 5                          // ниже меток/кластеров
        };

        const geom = feature.geometry || {};

        if (geom.type === 'Polygon' && Array.isArray(geom.coordinates)) {
          const yaCoords = convertPolygon(geom.coordinates);
          myMap.geoObjects.add(new ymaps.Polygon(yaCoords, polyProps, polyOpts));

        } else if (geom.type === 'MultiPolygon' && Array.isArray(geom.coordinates)) {
          const polygons = convertMultiPolygonToPolygons(geom.coordinates);
          polygons.forEach(yaCoords => {
            myMap.geoObjects.add(new ymaps.Polygon(yaCoords, polyProps, polyOpts));
          });
        }

        // Подпись округа: берём заранее заданную точку, если есть
        const labelCoord = AO_LABEL_COORDS[colorKey] || AO_LABEL_COORDS[String(nameRaw).toUpperCase()];
        if (labelCoord) {
          const label = new ymaps.Placemark(
            labelCoord,
            { text: nameRaw },
            {
              iconLayout: LabelLayout,
              hasBalloon: false,
              hasHint: false,
              zIndex: 120,                   // над заливкой, ниже кластеров
              zIndexHover: 120
            }
          );
          myMap.geoObjects.add(label);
        }
      });
    })
    .catch(err => console.error('Ошибка загрузки ao.geojson:', err));

  // 2) Точки из open.json (инвертируем только Point)
  fetch('open.json')
    .then(response => response.json())
    .then(obj => {
      let minLat = Infinity, maxLat = -Infinity;
      let minLon = Infinity, maxLon = -Infinity;

      obj.features.forEach(f => {
        if (f?.geometry?.type === "Point" && Array.isArray(f.geometry.coordinates)) {
          const [lon, lat] = f.geometry.coordinates;
          if (typeof lon === 'number' && typeof lat === 'number') {
            f.geometry.coordinates = [lat, lon]; // для Я.Карт
            minLat = Math.min(minLat, lat);
            maxLat = Math.max(maxLat, lat);
            minLon = Math.min(minLon, lon);
            maxLon = Math.max(maxLon, lon);
          }
        }
      });

      objectManager.removeAll();
      objectManager.add(obj);
      myMap.geoObjects.add(objectManager);

      if (minLat !== Infinity && maxLat !== -Infinity && minLon !== Infinity && maxLon !== -Infinity) {
        myMap.setBounds([[minLat, minLon], [maxLat, maxLon]], { checkZoomRange: true });
      }
    })
    .catch(err => console.error('Ошибка загрузки open.json:', err));

});
