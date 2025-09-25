ymaps.ready(function () {

    // Цвета округов
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
        // На случай если используются полные имена вместо аббревиатур:
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

    // Утилиты: безопасная конвертация координат из GeoJSON в формат Yandex ([lat, lon])
    const swapLngLatToLatLng = (pair) => [pair[1], pair[0]];

    const convertPolygon = (coords) => {
        // GeoJSON Polygon: [ [ [lng,lat] , ... ] , [ ...holes ] ]
        // Yandex Polygon:   [ [ [lat,lng] , ... ] , [ ...holes ] ]
        return coords.map(contour => contour.map(swapLngLatToLatLng));
    };

    const convertMultiPolygon = (coords) => {
        // GeoJSON MultiPolygon: [ [ [ [lng,lat], ...] /*outer*/, [/*hole*/] ], ... /* more polygons */ ]
        // Yandex MultiPolygon:  [ [ [ [lat,lng], ...], ... ], ... ]
        return coords.map(polygon => polygon.map(contour => contour.map(swapLngLatToLatLng)));
    };

    const myMap = new ymaps.Map("map", {
        center: [55.76, 37.64],
        zoom: 7,
        controls: [
            new ymaps.control.SearchControl({
                options: { float: 'right', noPlacemark: true }
            })
        ]
    });

    // Удаляем лишние контролы
    ['geolocationControl','trafficControl','fullscreenControl','zoomControl','rulerControl','typeSelector']
        .forEach(ctrl => myMap.controls.remove(ctrl));

    // Менеджер для точек
    const objectManager = new ymaps.ObjectManager({
        clusterize: true,
        clusterIconLayout: "default#pieChart"
    });

    // 1) Загружаем точки
    fetch('open.json')
        .then(response => response.json())
        .then(obj => {
            let minLatitude = Infinity, maxLatitude = -Infinity;
            let minLongitude = Infinity, maxLongitude = -Infinity;

            // Инвертируем координаты только у Point
            obj.features.forEach(feature => {
                if (feature?.geometry?.type === "Point" && Array.isArray(feature.geometry.coordinates)) {
                    const [lon, lat] = feature.geometry.coordinates;
                    if (typeof lon === 'number' && typeof lat === 'number') {
                        feature.geometry.coordinates = [lat, lon]; // Yandex: [lat, lon]

                        // Для приближений
                        minLatitude = Math.min(minLatitude, lat);
                        maxLatitude = Math.max(maxLatitude, lat);
                        minLongitude = Math.min(minLongitude, lon);
                        maxLongitude = Math.max(maxLongitude, lon);
                    }
                }
            });

            objectManager.removeAll();
            objectManager.add(obj);
            myMap.geoObjects.add(objectManager);

            // Поставим видимые границы по точкам, если есть валидные значения
            if (
                minLatitude !== Infinity && maxLatitude !== -Infinity &&
                minLongitude !== Infinity && maxLongitude !== -Infinity
            ) {
                myMap.setBounds([[minLatitude, minLongitude], [maxLatitude, maxLongitude]], {
                    checkZoomRange: true
                });
            }
        })
        .catch(err => console.error('Ошибка загрузки open.json:', err));

    // 2) Загружаем границы округов
    fetch('ao.geojson')
        .then(response => response.json())
        .then(geo => {
            geo.features.forEach(feature => {
                const props = feature.properties || {};
                const nameRaw = props.ABBREV || props.NAME || 'АО';
                const nameKey = String(nameRaw).toUpperCase();
                const color = AO_COLORS[nameKey] || "#dddddd";

                const baseProps = {
                    hintContent: nameRaw,
                    balloonContent: nameRaw
                };
                const baseOpts = {
                    fillColor: color,
                    fillOpacity: 0.3,
                    strokeColor: "#333",
                    strokeWidth: 2
                };

                const geom = feature.geometry || {};
                if (geom.type === 'Polygon' && Array.isArray(geom.coordinates)) {
                    // Конвертация Polygon
                    const yaCoords = convertPolygon(geom.coordinates);
                    const poly = new ymaps.Polygon(yaCoords, baseProps, baseOpts);
                    myMap.geoObjects.add(poly);

                } else if (geom.type === 'MultiPolygon' && Array.isArray(geom.coordinates)) {
                    // Конвертация MultiPolygon
                    const yaCoordsMP = convertMultiPolygon(geom.coordinates);
                    const mpoly = new ymaps.MultiPolygon(yaCoordsMP, baseProps, baseOpts);
                    myMap.geoObjects.add(mpoly);
                }
            });
        })
        .catch(err => console.error('Ошибка загрузки ao.geojson:', err));
});
