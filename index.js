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
        "ЗЕЛАО": "#f5deb3",
        // на случай, если вместо ABBREV придут полные названия:
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

    // Хелперы: [lng,lat] -> [lat,lng]
    const swapLngLat = p => [p[1], p[0]];
    const convertPolygon = coords => coords.map(contour => contour.map(swapLngLat));
    const convertMultiPolygonToPolygons = coords =>
        coords.map(polygonContours => convertPolygon(polygonContours)); // вернёт массив отдельных полигонов

    const myMap = new ymaps.Map("map", {
        center: [55.76, 37.64],
        zoom: 7,
        controls: [
            new ymaps.control.SearchControl({
                options: { float: 'right', noPlacemark: true }
            })
        ]
    });

    // Приберём лишние контролы
    ['geolocationControl','trafficControl','fullscreenControl','zoomControl','rulerControl','typeSelector']
        .forEach(ctrl => myMap.controls.remove(ctrl));

    // Менеджер для точек
    const objectManager = new ymaps.ObjectManager({
        clusterize: true,
        clusterIconLayout: "default#pieChart"
    });

    // 1) Слой округов (рисуем раньше, чтобы точки были поверх)
    fetch('ao.geojson')
        .then(r => r.json())
        .then(geo => {
            geo.features.forEach(feature => {
                const props = feature.properties || {};
                const abbrev = props.ABBREV;               // 'ЦАО', 'СВАО', 'ЗелАО', 'Троицкий' и т.п.
                const nameRaw = props.NAME || abbrev || 'АО';
                const colorKey = (abbrev || String(nameRaw).toUpperCase());
                const color = AO_COLORS[colorKey] || "#dddddd";

                const commonProps = {
                    hintContent: nameRaw,
                    balloonContent: nameRaw
                };
                const commonOpts = {
                    fillColor: color,
                    fillOpacity: 0.25,
                    strokeColor: "#333",
                    strokeWidth: 2,
                    strokeOpacity: 0.9,
                    zIndex: 5 // полигоны ниже меток
                };

                const geom = feature.geometry || {};
                if (geom.type === 'Polygon' && Array.isArray(geom.coordinates)) {
                    // Один полигон
                    const yaCoords = convertPolygon(geom.coordinates);
                    const polygon = new ymaps.Polygon(yaCoords, commonProps, commonOpts);
                    myMap.geoObjects.add(polygon);

                } else if (geom.type === 'MultiPolygon' && Array.isArray(geom.coordinates)) {
                    // Разбиваем мультиполигон на отдельные полигоны
                    const polygons = convertMultiPolygonToPolygons(geom.coordinates);
                    polygons.forEach(yaCoords => {
                        const polygon = new ymaps.Polygon(yaCoords, commonProps, commonOpts);
                        myMap.geoObjects.add(polygon);
                    });
                } else {
                    // Неподдерживаемый тип геометрии – тихо пропускаем
                    // console.warn('Unknown geometry type for AO feature:', geom.type);
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
