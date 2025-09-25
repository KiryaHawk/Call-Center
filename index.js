ymaps.ready(function () {

    fetch('open.json')
        .then(response => response.json())
        .then(obj => {

            const searchControls = new ymaps.control.SearchControl({
                options: {
                    float: 'right',
                    noPlacemark: true
                }
            });

            const myMap = new ymaps.Map("map", {
                center: [55.76, 37.64],
                zoom: 7,
                controls: [searchControls]
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

            // Границы
            let minLatitude = Infinity, maxLatitude = -Infinity;
            let minLongitude = Infinity, maxLongitude = -Infinity;

            obj.features.forEach(feature => {
                if (feature.geometry && feature.geometry.coordinates) {
                    const [longitude, latitude] = feature.geometry.coordinates;
                    feature.geometry.coordinates = [latitude, longitude];

                    minLatitude = Math.min(minLatitude, latitude);
                    maxLatitude = Math.max(maxLatitude, latitude);
                    minLongitude = Math.min(minLongitude, longitude);
                    maxLongitude = Math.max(maxLongitude, longitude);
                }
            });

            objectManager.add(obj);
            myMap.geoObjects.add(objectManager);

            if (minLatitude !== Infinity && maxLatitude !== -Infinity &&
                minLongitude !== Infinity && maxLongitude !== -Infinity) {
                myMap.setBounds([[minLatitude, minLongitude], [maxLatitude, maxLongitude]], {
                    checkZoomRange: true
                });
            }

            // Загружаем и добавляем округа
            fetch('ao.geojson')
                .then(resp => resp.json())
                .then(geo => {
                    const aoColors = {
                        "ЦЕНТРАЛЬНЫЙ": "#ffcccc",
                        "ЮЖНЫЙ": "#ccffcc",
                        "СЕВЕРНЫЙ": "#ccccff",
                        "ВОСТОЧНЫЙ": "#ffffcc",
                        "ЗАПАДНЫЙ": "#ffd9b3",
                        "СЕВЕРО-ВОСТОЧНЫЙ": "#e6ccff",
                        "СЕВЕРО-ЗАПАДНЫЙ": "#ccffff",
                        "ЮГО-ВОСТОЧНЫЙ": "#ffcce0",
                        "ЮГО-ЗАПАДНЫЙ": "#b3e6b3",
                        "НОВОМОСКОВСКИЙ": "#f0e68c",
                        "ЗЕЛЕНОГРАДСКИЙ": "#f5deb3",
                        "ТРОИЦКИЙ": "#ffe4e1"
                    };

                    geo.features.forEach(feature => {
                        const rawName = feature?.properties?.NAME || "НЕИЗВЕСТНО";
                        const name = String(rawName).toUpperCase();
                        const color = aoColors[name] || "#dddddd";

                        feature.options = {
                            fillColor: color,
                            strokeColor: "#333333",
                            opacity: 0.4,
                            fillOpacity: 0.3,
                            strokeWidth: 2
                        };

                        feature.properties.balloonContent = rawName + " административный округ";
                        feature.properties.hintContent = rawName;
                    });

                    const aoObjectManager = new ymaps.ObjectManager({
                        geoObjectOpenBalloonOnClick: false
                    });

                    aoObjectManager.add(geo);
                    myMap.geoObjects.add(aoObjectManager);
                });
        });
});
