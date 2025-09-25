ymaps.ready(function () {

    const myMap = new ymaps.Map("map", {
        center: [55.76, 37.64],
        zoom: 7,
        controls: [
            new ymaps.control.SearchControl({
                options: {
                    float: 'right',
                    noPlacemark: true
                }
            })
        ]
    });

    const removeControls = [
        'geolocationControl',
        'trafficControl',
        'fullscreenControl',
        'zoomControl',
        'rulerControl',
        'typeSelector'
    ];
    removeControls.forEach(ctrl => myMap.controls.remove(ctrl));

    const objectManager = new ymaps.ObjectManager({
        clusterize: true,
        clusterIconLayout: "default#pieChart"
    });

    // Загружаем точки
    fetch('open.json')
        .then(response => response.json())
        .then(obj => {
            let minLatitude = Infinity, maxLatitude = -Infinity;
            let minLongitude = Infinity, maxLongitude = -Infinity;

            obj.features.forEach(feature => {
                if (feature.geometry && feature.geometry.coordinates) {
                    const [lon, lat] = feature.geometry.coordinates;
                    minLatitude = Math.min(minLatitude, lat);
                    maxLatitude = Math.max(maxLatitude, lat);
                    minLongitude = Math.min(minLongitude, lon);
                    maxLongitude = Math.max(maxLongitude, lon);
                }
            });

            objectManager.removeAll();
            objectManager.add(obj);
            myMap.geoObjects.add(objectManager);

            if (
                minLatitude !== Infinity && maxLatitude !== -Infinity &&
                minLongitude !== Infinity && maxLongitude !== -Infinity
            ) {
                myMap.setBounds([[minLatitude, minLongitude], [maxLatitude, maxLongitude]], {
                    checkZoomRange: true
                });
            }
        });

    // Загружаем границы округов
    fetch('ao.geojson')
        .then(response => response.json())
        .then(geo => {
            const aoColors = {
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
                "Троицкий": "#ffe4b5",
                "Новомосковский": "#dcdcdc"
            };

            const aoObjectManager = new ymaps.ObjectManager({
                geoObjectOpenBalloonOnClick: false
            });

            geo.features.forEach(feature => {
                const abbrev = feature?.properties?.ABBREV;
                const color = aoColors[abbrev] || "#dddddd";

                feature.options = {
                    fillColor: color,
                    strokeColor: "#333",
                    strokeWidth: 2,
                    opacity: 0.4,
                    fillOpacity: 0.3
                };

                feature.properties.balloonContent = abbrev;
                feature.properties.hintContent = abbrev;
            });

            aoObjectManager.add(geo);
            myMap.geoObjects.add(aoObjectManager);
        });

});
