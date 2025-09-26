ymaps.ready(function () {

  // ===== Палитра, координаты подписей, лейаут =====
  const AO_COLORS = {
    "ЦАО":"#ffcccc","ЮАО":"#ccffcc","САО":"#ccccff","ВАО":"#ffffcc","ЗАО":"#ffd9b3",
    "СВАО":"#e6ccff","СЗАО":"#ccffff","ЮВАО":"#ffcce0","ЮЗАО":"#b3e6b3",
    "НАО":"#f0e68c","ЗелАО":"#f5deb3",
    "ТРОИЦКИЙ":"#ffe4b5","НОВОМОСКОВСКИЙ":"#dcdcdc","ЗЕЛЕНОГРАДСКИЙ":"#f5deb3",
    "ЦЕНТРАЛЬНЫЙ":"#ffcccc","ЮЖНЫЙ":"#ccffcc","СЕВЕРНЫЙ":"#ccccff","ВОСТОЧНЫЙ":"#ffffcc",
    "ЗАПАДНЫЙ":"#ffd9b3","СЕВЕРО-ВОСТОЧНЫЙ":"#e6ccff","СЕВЕРО-ЗАПАДНЫЙ":"#ccffff",
    "ЮГО-ВОСТОЧНЫЙ":"#ffcce0","ЮГО-ЗАПАДНЫЙ":"#b3e6b3"
  };
  const AO_LABEL_COORDS = {
    "ЦАО":[55.752,37.62],"САО":[55.867,37.536],"СВАО":[55.874,37.68],"ВАО":[55.785,37.82],
    "ЮВАО":[55.70,37.79],"ЮАО":[55.63,37.64],"ЮЗАО":[55.64,37.49],"ЗАО":[55.72,37.40],
    "СЗАО":[55.81,37.40],"ЗелАО":[55.98,37.20],"НОВОМОСКОВСКИЙ":[55.55,37.35],"ТРОИЦКИЙ":[55.43,37.28],
    "ЗЕЛЕНОГРАДСКИЙ":[55.98,37.20],"НАО":[55.55,37.35]
  };

  // Панель стилей (подписи округов и фильтр)
  const style = document.createElement('style');
  style.textContent = `
    :root { --aoLabelSize: 16px; }
    .ao-label{
      position:relative; transform:translate(-50%,-50%); pointer-events:none;
      font:700 var(--aoLabelSize)/1.1 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Arial,sans-serif;
      color:#111; text-align:center; white-space:nowrap;
      text-shadow:0 0 2px #fff,0 0 6px #fff,1px 0 0 #fff,-1px 0 0 #fff,0 1px 0 #fff,0 -1px 0 #fff;
    }
    .filter-panel{
      position:absolute; top:12px; left:12px; z-index:1000; background:#fff; border-radius:12px;
      box-shadow:0 4px 18px rgba(0,0,0,.15); padding:10px 12px; max-width:280px; font:13px/1.3 Arial, sans-serif;
    }
    .filter-panel h4{ margin:0 0 6px; font-size:14px; }
    .filter-grid{ display:grid; grid-template-columns:repeat(3,1fr); gap:6px 10px; }
    .filter-grid label{ user-select:none; cursor:pointer; white-space:nowrap; }
    .filter-actions{ display:flex; gap:8px; margin-top:8px; }
    .btn{ border:1px solid #d0d7de; background:#f6f8fa; padding:4px 8px; border-radius:8px; cursor:pointer; }
    .btn:hover{ background:#eef1f4; }
  `;
  document.head.appendChild(style);
  const setLabelSize = px => document.documentElement.style.setProperty('--aoLabelSize', px + 'px');

  const LabelLayout = ymaps.templateLayoutFactory.createClass(
    '<div class="ao-label">$[properties.text]</div>'
  );

  // ===== Конвертеры координат GeoJSON -> Yandex =====
  const swapLngLat = p => [p[1], p[0]];
  const convertPolygon = coords => coords.map(contour => contour.map(swapLngLat));
  const convertMultiPolygonToPolygons = coords => coords.map(poly => convertPolygon(poly));

  // ===== Карта =====
  const searchControl = new ymaps.control.SearchControl({
    options:{ float:'right', noPlacemark:true }
  });
  const myMap = new ymaps.Map("map", {
    center: [55.76, 37.64], zoom: 9,
    controls: [searchControl]
  });
  ['geolocationControl','trafficControl','fullscreenControl','zoomControl','rulerControl','typeSelector']
    .forEach(ctrl => myMap.controls.remove(ctrl));

  // >>> Показывать подсказки сразу при наборе
  (function enableInstantSuggest(){
    const container = searchControl.getContainer && searchControl.getContainer();
    const input = container && container.querySelector('input[type="text"]');
    if (input){
      if (!input.id) input.id = 'map-search-input';
      new ymaps.SuggestView(input.id);
    }
  })();
  // <<<

  const objectManager = new ymaps.ObjectManager({ clusterize:true, clusterIconLayout:"default#pieChart" });

  // Подписи масштаб: меньше на далёком зуме
  const updateLabelSizeByZoom = () => {
    const z = myMap.getZoom();
    let size = 18; if (z>=13) size=18; else if (z>=12) size=17; else if (z>=11) size=16;
    else if (z>=10) size=14; else if (z>=9) size=13; else if (z>=8) size=12; else if (z>=7) size=11; else size=10;
    setLabelSize(size);
  };
  updateLabelSizeByZoom();
  myMap.events.add('boundschange', updateLabelSizeByZoom);

  // ===== 1) Границы округов + подписи =====
  fetch('ao.geojson').then(r=>r.json()).then(geo=>{
    geo.features.forEach(f=>{
      const props=f.properties||{};
      const abbrev=props.ABBREV;
      const nameRaw=props.NAME||abbrev||'АО';
      const key=(abbrev||String(nameRaw).toUpperCase());
      const color=AO_COLORS[key]||'#ddd';

      const polyOpts={ fillColor:color, fillOpacity:0.5, strokeColor:'#222', strokeWidth:2, strokeOpacity:0.95, zIndex:5 };
      const geom=f.geometry||{};
      if (geom.type==='Polygon') {
        myMap.geoObjects.add(new ymaps.Polygon(convertPolygon(geom.coordinates), {hintContent:nameRaw, balloonContent:nameRaw}, polyOpts));
      } else if (geom.type==='MultiPolygon') {
        convertMultiPolygonToPolygons(geom.coordinates).forEach(yaCoords=>{
          myMap.geoObjects.add(new ymaps.Polygon(yaCoords, {hintContent:nameRaw, balloonContent:nameRaw}, polyOpts));
        });
      }
      const labelCoord = AO_LABEL_COORDS[key] || AO_LABEL_COORDS[String(nameRaw).toUpperCase()];
      if (labelCoord){
        myMap.geoObjects.add(new ymaps.Placemark(labelCoord, {text:nameRaw}, {iconLayout:LabelLayout, hasBalloon:false, hasHint:false, zIndex:120, zIndexHover:120}));
      }
    });
  }).catch(err=>console.error('Ошибка ao.geojson:', err));

  // ===== 2) Точки + ФИЛЬТР =====
  // Категории
  const CATEGORY_CODES = ["A(L)","B(M1)","B(N1)","C(N2)","C(N3)","E(O1)","E(O2)","E(O3)","E(O4)"];
  const selected = new Set();

  // Панель фильтра
  const panel = document.createElement('div');
  panel.className = 'filter-panel';
  panel.innerHTML = `
    <h4>Фильтр по категориям</h4>
    <div class="filter-grid">
      ${CATEGORY_CODES.map(c=>`<label><input type="checkbox" value="${c}"> ${c}</label>`).join('')}
    </div>
    <div class="filter-actions">
      <button class="btn" id="flt-all">Все</button>
      <button class="btn" id="flt-clear">Сброс</button>
    </div>
  `;
  // вставим поверх карты
  document.body.appendChild(panel);

  // Обработчики
  panel.querySelectorAll('input[type=checkbox]').forEach(ch=>{
    ch.addEventListener('change', ()=>{
      if (ch.checked) selected.add(ch.value); else selected.delete(ch.value);
      applyFilter();
    });
  });
  panel.querySelector('#flt-all').addEventListener('click', ()=>{
    selected.clear(); // показываем все
    panel.querySelectorAll('input[type=checkbox]').forEach(ch=>ch.checked=false);
    applyFilter();
  });
  panel.querySelector('#flt-clear').addEventListener('click', ()=>{
    selected.clear();
    panel.querySelectorAll('input[type=checkbox]').forEach(ch=>ch.checked=false);
    applyFilter();
  });

  // Детектор категорий у объекта
  const ESC = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  function getCatsFromObj(obj){
    // 1) если есть properties.cats — используем
    if (Array.isArray(obj.properties?.cats)) return obj.properties.cats;

    // 2) если уже вычисляли — вернём кеш
    if (Array.isArray(obj.properties?._catsDetected)) return obj.properties._catsDetected;

    // 3) извлечём из HTML балуна
    const html = String(obj.properties?.balloonContentBody || '');
    const cats = [];
    CATEGORY_CODES.forEach(code=>{
      const re = new RegExp(ESC(code), 'i');
      if (re.test(html)) cats.push(code);
    });
    obj.properties._catsDetected = cats;
    return cats;
  }

  // Применить фильтр
  function applyFilter(){
    if (selected.size === 0){
      objectManager.setFilter(() => true);
      return;
    }
    objectManager.setFilter(obj=>{
      const cats = getCatsFromObj(obj);
      if (!cats || cats.length===0) return false;
      for (const c of cats) if (selected.has(c)) return true;
      return false;
    });
  }

  // Загружаем open.json и инвертируем координаты Point
  fetch('open.json').then(r=>r.json()).then(obj=>{
    let minLat=Infinity, maxLat=-Infinity, minLon=Infinity, maxLon=-Infinity;

    obj.features.forEach(f=>{
      if (f?.geometry?.type==="Point" && Array.isArray(f.geometry.coordinates)){
        const [lon,lat] = f.geometry.coordinates;
        if (typeof lon==='number' && typeof lat==='number'){
          f.geometry.coordinates = [lat, lon];
          minLat=Math.min(minLat,lat); maxLat=Math.max(maxLat,lat);
          minLon=Math.min(minLon,lon); maxLon=Math.max(maxLon,lon);
        }
      }
    });

    objectManager.removeAll();
    objectManager.add(obj);
    myMap.geoObjects.add(objectManager);
    applyFilter(); // включим фильтр (по умолчанию "все")

    if (minLat!==Infinity && maxLat!==-Infinity && minLon!==Infinity && maxLon!==-Infinity){
      myMap.setBounds([[minLat,minLon],[maxLat,maxLon]], { checkZoomRange:true });
    }
  }).catch(err=>console.error('Ошибка open.json:', err));

});
