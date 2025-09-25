ymaps.ready(function () {

    // Палитра округов
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
        // на случай полного имени вместо аббревиатуры
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

    // Хелперы конвертации координат GeoJSON -> Yandex ([lon,lat] -> [lat,lon])
    const swapLngLatToLatLng = (p) => [p[1], p[0]];
    const convertPolygon = (coords) => coords.map(contour => contour.map(swapLngLatToLatLng));
    const convertMultiPolygon = (coords) =>
        coords.map(polygon => polygon.map(contour => contour.map(swapLngLatToLatLng)));

    const myMap = new ymaps.Map("map", {
        center: [55.76, 37.64],
        zoom: 7,
        controls: [
            new ymaps.control.SearchControl({
                options: { float: 'right', noPlacemark: true }
            })
        ]
    });

    ['geolocationControl','trafficControl','fullscreenControl','zoomControl','rulerControl','typeSelector']
        .forEach(ctrl => myMap.controls.remove(ctrl));

    const objectManager = new ymaps.ObjectManager({
        clusterize: true,
        clusterIconLayout: "default#pieChart"
    });

    // 1) Точки из open.json (инвертируем только Point)
    fetch('open.json')
        .then(r => r.json())
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

    // 2) Границы округов из ao.geojson
    fetch('ao.geojson')
        .then(r => r.json())
        .then(geo => {
            geo.features.forEach(feature => {
                const props = feature.properties || {};
                const abbrev = props.ABBREV;        // например: 'ЦАО', 'СВАО', 'ЗелАО'
                const nameRaw = props.NAME || abbrev || 'АО';
                const colorKey = abbrev || String(nameRaw).toUpperCase();
                const color = AO_COLORS[colorKey] || "#dddddd";

                const commonProps = {
                    hintContent: nameRaw,
                    balloonContent: nameRaw
                };
                const commonOpts = {
                    fillColor: color,
                    fillOpacity: 0.3,
                    strokeColor: "#333",
                    strokeWidth: 2
                };

                const geom = feature.geometry || {};
                if (geom.type === 'Polygon' && Array.isArray(geom.coordinates)) {
                    const yaCoords = convertPolygon(geom.coordinates);
                    const polygon = new ymaps.Polygon(yaCoords, commonProps, commonOpts);
                    myMap.geoObjects.add(polygon);

                } else if (geom.type === 'MultiPolygon' && Array.isArray(geom.coordinates)) {
                    const yaCoordsMP = convertMultiPolygon(geom.coordinates);
                    // В API нет конструктора ymaps.MultiPolygon — используем GeoObject:
                    const mpoly = new ymaps.GeoObject({
                        geometry: { type: 'MultiPolygon', coordinates: yaCoordsMP },
                        properties: commonProps
                    }, commonOpts);
                    myMap.geoObjects.add(mpoly);
                }
            });
        })
        .catch(err => console.error('Ошибка загрузки ao.geojson:', err));
});
