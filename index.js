ymaps.ready(function () {

    // Палитра цветов по округам
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
        // на случай полных названий:
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

    // Вставим CSS для «текстовых лейблов»
    const style = document.createElement('style');
    style.textContent = `
      .ao-label{
        position:relative;
        transform: translate(-50%, -50%);
        pointer-events:none;             /* не перехватывает клики */
        font: 700 16px/1.1 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Arial,sans-serif;
        color:#111;
        text-align:center;
        white-space:nowrap;
        text-shadow:
          0 0 2px #fff, 0 0 6px #fff,
          1px 0 0 #fff, -1px 0 0 #fff, 0 1px 0 #fff, 0 -1px 0 #fff;
      }
      @media (max-width: 600px){ .ao-label{ font-size:12px; } }
    `;
    document.head.appendChild(style);

    // Кастомный layout: чистый текст без иконки
    const LabelLayout = ymaps.templateLayoutFactory.createClass(
      '<div class="ao-label">$[properties.text]</div>'
    );

    // Хелперы: [lng,lat] -> [lat,lng]
    const swapLngLat = p => [p[1], p[0]];
    const convertPolygon = coords => coords.map(contour => contour.map(swapLngLat));
    const convertMultiPolygonToPolygons = coords =>
        coords.map(polygonContours => convertPolygon(polygonContours)); // массив отдельных полигонов

    // Получение bbox и центра для YA-полигонов
    const getBoundsFromYaPolygon = (yaCoords) => {
        let minLat = Infinity, maxLat = -Infinity, minLon = Infinity, maxLon = -Infinity;
        yaCoords.forEach(ring => {
            ring.forEach(([lat, lon]) => {
                if (typeof lat === 'number' && typeof lon === 'number') {
                    minLat = Math.min(minLat, lat);
                    maxLat = Math.max(maxLat, lat);
                    minLon = Math.min(minLon, lon);
                    maxLon = Math.max(maxLon, lon);
                }
            });
        });
        return (minLat === Infinity) ? null : [[minLat, minLon], [maxLat, maxLon]];
    };
    const centerFromBounds = (b) => [(b[0][0] + b[1][0]) / 2, (b[0][1] + b[1][1]) / 2];

    const myMap = new ymaps.Map("map", {
        center: [55.76, 37.64],
        zoom: 7,
        controls: [
            new ymaps.control.SearchControl({ options: { float: 'right', noPlacemark: true } })
        ]
    });

    ['geolocationControl','trafficControl','fullscreenControl','zoomControl','rulerControl','typeSelector']
        .forEach(ctrl => myMap.controls.remove(ctrl));

    // Менеджер для точек
    const objectManager = new ymaps.ObjectManager({
        clusterize: true,
        clusterIconLayout: "default#pieChart"
    });

    // 1) Слой округов (ниже точек), заливка плотнее и подписи текстом
    fetch('ao.geojson')
        .then(r => r.json())
        .then(geo => {
            geo.features.forEach(feature => {
                const props = feature.properties || {};
                const abbrev = props.ABBREV;
                const nameRaw = props.NAME || abbrev || 'АО';
                const colorKey = (abbrev || String(nameRaw).toUpperCase());
                const color = AO_COLORS[colorKey] || "#dddddd";

                const polyProps = { hintContent: nameRaw, balloonContent: nameRaw };
                const polyOpts = {
                    fillColor: color,
                    fillOpacity: 0.5,       // ← более плотная заливка
                    strokeColor: "#222",
                    strokeWidth: 2,
                    strokeOpacity: 0.95,
                    zIndex: 5
                };

                const geom = feature.geometry || {};
                let unionBounds = null; // общий bbox для подписи

                if (geom.type === 'Polygon' && Array.isArray(geom.coordinates)) {
                    const yaCoords = convertPolygon(geom.coordinates);
                    const polygon = new ymaps.Polygon(yaCoords, polyProps, polyOpts);
                    myMap.geoObjects.add(polygon);

                    const b = getBoundsFromYaPolygon(yaCoords);
                    if (b) unionBounds = b;

                } else if (geom.type === 'MultiPolygon' && Array.isArray(geom.coordinates)) {
                    const polygons = convertMultiPolygonToPolygons(geom.coordinates);
                    polygons.forEach(yaCoords => {
                        const polygon = new ymaps.Polygon(yaCoords, polyProps, polyOpts);
                        myMap.geoObjects.add(polygon);

                        const b = getBoundsFromYaPolygon(yaCoords);
                        if (b) {
                            if (!unionBounds) {
                                unionBounds = b;
                            } else {
                                unionBounds = [
                                    [Math.min(unionBounds[0][0], b[0][0]), Math.min(unionBounds[0][1], b[0][1])],
                                    [Math.max(unionBounds[1][0], b[1][0]), Math.max(unionBounds[1][1], b[1][1])]
                                ];
                            }
                        }
                    });
                }

                // Подпись округа как «текст без метки»
                if (unionBounds) {
                    const center = centerFromBounds(unionBounds);
                    const label = new ymaps.Placemark(
                        center,
                        { text: nameRaw },
                        {
                            iconLayout: LabelLayout, // чистый текст
                            hasBalloon: false,
                            hasHint: false,
                            zIndex: 200,             // над заливкой и точками кластера
                            zIndexHover: 200
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
                        f.geometry.coordinates = [lat, lon]; // Yandex: [lat, lon]
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
