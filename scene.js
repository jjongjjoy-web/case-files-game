/* ===================================================
   scene.js — PenthouseScene 클래스
   Three.js 3D 펜트하우스 서재 수사 공간 렌더링 전담
   =================================================== */

class PenthouseScene {
  constructor(canvasId) {
    this.canvas = document.getElementById(canvasId);
    this.width = this.canvas.clientWidth || this.canvas.parentElement.clientWidth || 800;
    this.height = this.canvas.clientHeight || this.canvas.parentElement.clientHeight || 600;

    // 핵심 Three.js 컴포넌트
    this.renderer = null;
    this.scene = null;
    this.camera = null;
    this.clock = new THREE.Clock();

    // 인터랙션 & 카메라 제어 상태
    this.isAnimating = true;
    this.isDragging = false;
    this.previousMousePosition = { x: 0, y: 0 };
    this.cameraAngleY = Math.PI / 2; // 초기 각도
    this.cameraRadius = 5.2; // 카메라 원형 궤도 반경
    this.cameraTargetY = 1.3; // 바라보는 Y축 중심

    // 마우스 호버 및 레이캐스팅
    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();
    this.hoveredObject = null;

    // 조명 흔들림 및 펜듈럼
    this.bulbLight = null;
    this.bulbMesh = null;
    this.bulbPivot = null;
    this.flickerTimer = 0;
    this.flickerInterval = 2 + Math.random() * 4;

    // 단서 객체 목록 매핑
    this.clueMeshes = {};
    
    // 먼지 파티클
    this.particles = null;
    this.particleVelocities = [];

    this._init();
    this._animate();
  }

  /* ── 초기화 ── */
  _init() {
    // 렌더러 구축
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      alpha: false
    });
    this.renderer.setSize(this.width, this.height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ReinhardToneMapping;
    this.renderer.toneMappingExposure = 0.55;

    // 씬과 안개
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x050508);
    this.scene.fog = new THREE.FogExp2(0x050508, 0.12);

    // 카메라 (책상을 향함)
    this.camera = new THREE.PerspectiveCamera(48, this.width / this.height, 0.1, 50);
    this._updateCameraPosition();

    // 씬 구성요소 생성
    this._buildRoom();
    this._buildFurniture();
    this._buildClues();
    this._buildLighting();
    this._buildParticles();

    // 이벤트 리스너 등록
    this._setupEvents();
  }

  /* ── 카메라 위치 계산 (드래그 회전 반영) ── */
  _updateCameraPosition() {
    const x = Math.cos(this.cameraAngleY) * this.cameraRadius;
    const z = Math.sin(this.cameraAngleY) * this.cameraRadius;
    this.camera.position.set(x, 2.2, z);
    this.camera.lookAt(0, this.cameraTargetY, 0);
  }

  /* ── 이벤트 바인딩 ── */
  _setupEvents() {
    // 마우스 드래그를 이용한 수평 패닝(회전)
    const onMouseDown = (e) => {
      this.isDragging = true;
      this.previousMousePosition = { x: e.clientX, y: e.clientY };
    };

    const onMouseMove = (e) => {
      // 레이캐스팅을 위한 마우스 좌표 갱신 (-1 to +1)
      const rect = this.canvas.getBoundingClientRect();
      this.mouse.x = ((e.clientX - rect.left) / this.width) * 2 - 1;
      this.mouse.y = -((e.clientY - rect.top) / this.height) * 2 + 1;

      if (this.isDragging) {
        const deltaX = e.clientX - this.previousMousePosition.x;
        // 드래그 속도 조절
        this.cameraAngleY -= deltaX * 0.007;
        this._updateCameraPosition();
        this.previousMousePosition = { x: e.clientX, y: e.clientY };
      } else {
        this._handleHover();
      }
    };

    const onMouseUp = () => {
      this.isDragging = false;
    };

    // 클릭 시 단서 탐지
    const onClick = () => {
      if (this.isDragging) return;
      this.raycaster.setFromCamera(this.mouse, this.camera);
      const intersects = this.raycaster.intersectObjects(this.scene.children, true);
      
      for (let i = 0; i < intersects.length; i++) {
        let obj = intersects[i].object;
        // clueId를 가진 부모 노드를 찾을 때까지 거슬러 올라감
        while (obj && obj !== this.scene) {
          if (obj.userData && obj.userData.clueId) {
            const clueId = obj.userData.clueId;
            if (window.game && typeof window.game.onClueFound === 'function') {
              window.game.onClueFound(clueId);
            }
            return;
          }
          obj = obj.parent;
        }
      }
    };

    // 터치 대응
    const onTouchStart = (e) => {
      if (e.touches.length === 1) {
        this.isDragging = true;
        this.previousMousePosition = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      }
    };

    const onTouchMove = (e) => {
      if (this.isDragging && e.touches.length === 1) {
        const rect = this.canvas.getBoundingClientRect();
        this.mouse.x = ((e.touches[0].clientX - rect.left) / this.width) * 2 - 1;
        this.mouse.y = -((e.touches[0].clientY - rect.top) / this.height) * 2 + 1;

        const deltaX = e.touches[0].clientX - this.previousMousePosition.x;
        this.cameraAngleY -= deltaX * 0.007;
        this._updateCameraPosition();
        this.previousMousePosition = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      }
    };

    this.canvas.addEventListener('mousedown', onMouseDown);
    this.canvas.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    this.canvas.addEventListener('click', onClick);

    this.canvas.addEventListener('touchstart', onTouchStart, { passive: true });
    this.canvas.addEventListener('touchmove', onTouchMove, { passive: true });
    this.canvas.addEventListener('touchend', onMouseUp);

    // 윈도우 리사이즈
    this._resizeObserver = new ResizeObserver(() => this._onResize());
    this._resizeObserver.observe(this.canvas.parentElement);
  }

  _onResize() {
    const w = this.canvas.parentElement.clientWidth;
    const h = this.canvas.parentElement.clientHeight;
    this.width = w;
    this.height = h;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  }

  /* ── 마우스 호버 시 단서 하이라이트 ── */
  _handleHover() {
    this.raycaster.setFromCamera(this.mouse, this.camera);
    const intersects = this.raycaster.intersectObjects(this.scene.children, true);

    let foundClueObj = null;
    for (let i = 0; i < intersects.length; i++) {
      let obj = intersects[i].object;
      while (obj && obj !== this.scene) {
        if (obj.userData && obj.userData.clueId) {
          foundClueObj = obj;
          break;
        }
        obj = obj.parent;
      }
      if (foundClueObj) break;
    }

    if (foundClueObj) {
      if (this.hoveredObject !== foundClueObj) {
        this._setClueHighlight(this.hoveredObject, false);
        this.hoveredObject = foundClueObj;
        this._setClueHighlight(this.hoveredObject, true);
        this.canvas.style.cursor = 'pointer';
      }
    } else {
      if (this.hoveredObject) {
        this._setClueHighlight(this.hoveredObject, false);
        this.hoveredObject = null;
        this.canvas.style.cursor = 'grab';
      }
    }
  }

  _setClueHighlight(obj, enable) {
    if (!obj) return;
    obj.traverse(child => {
      if (child.isMesh && child.material) {
        if (enable) {
          child.userData.originalEmissive = child.userData.originalEmissive || child.material.emissive?.getHex() || 0x000000;
          child.material.emissive?.setHex(0xe8c87a);
          child.material.emissiveIntensity = 0.8;
        } else {
          const original = child.userData.originalEmissive || 0x000000;
          child.material.emissive?.setHex(original);
          child.material.emissiveIntensity = child.material.emissive?.getHex() === 0 ? 0 : 0.2;
        }
      }
    });
  }

  /* ── 3D 방 구축 (서재) ── */
  _buildRoom() {
    const wallMat = new THREE.MeshStandardMaterial({ color: 0x0d0d12, roughness: 0.95 });
    const floorMat = new THREE.MeshStandardMaterial({ color: 0x0a0907, roughness: 0.85 });

    // 바닥
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(8, 8), floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    this.scene.add(floor);

    // 바닥 타일 그리드 데코레이션
    const floorGrid = new THREE.GridHelper(8, 16, 0x221f18, 0x121008);
    floorGrid.position.y = 0.002;
    this.scene.add(floorGrid);

    // 천장
    const ceiling = new THREE.Mesh(new THREE.PlaneGeometry(8, 8), wallMat);
    ceiling.rotation.x = Math.PI / 2;
    ceiling.position.y = 4.0;
    this.scene.add(ceiling);

    // 벽면들 (서재 느낌을 내기 위해 사방을 둘러쌈)
    const wallGeom = new THREE.PlaneGeometry(8, 4);

    // 뒷벽 (Z = -4)
    const backWall = new THREE.Mesh(wallGeom, wallMat);
    backWall.position.set(0, 2.0, -4.0);
    backWall.receiveShadow = true;
    this.scene.add(backWall);

    // 앞벽 (Z = 4)
    const frontWall = new THREE.Mesh(wallGeom, wallMat);
    frontWall.position.set(0, 2.0, 4.0);
    frontWall.rotation.y = Math.PI;
    this.scene.add(frontWall);

    // 좌측벽 (X = -4)
    const leftWall = new THREE.Mesh(wallGeom, wallMat);
    leftWall.position.set(-4.0, 2.0, 0);
    leftWall.rotation.y = Math.PI / 2;
    leftWall.receiveShadow = true;
    this.scene.add(leftWall);

    // 우측벽 (X = 4)
    const rightWall = new THREE.Mesh(wallGeom, wallMat);
    rightWall.position.set(4.0, 2.0, 0);
    rightWall.rotation.y = -Math.PI / 2;
    rightWall.receiveShadow = true;
    this.scene.add(rightWall);
  }

  /* ── 가구 배치 ── */
  _buildFurniture() {
    const woodMat = new THREE.MeshStandardMaterial({ color: 0x1d130a, roughness: 0.8 });
    const metalMat = new THREE.MeshStandardMaterial({ color: 0x202025, roughness: 0.5, metalness: 0.8 });

    // 1. 책상 (중앙)
    const desk = new THREE.Group();
    // 상판
    const deskTop = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.08, 1.1), woodMat);
    deskTop.position.y = 0.95;
    deskTop.castShadow = true;
    deskTop.receiveShadow = true;
    desk.add(deskTop);

    // 다리 4개
    [[-1.0, -0.45], [1.0, -0.45], [-1.0, 0.45], [1.0, 0.45]].forEach(([x, z]) => {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.95, 0.08), woodMat);
      leg.position.set(x, 0.475, z);
      leg.castShadow = true;
      desk.add(leg);
    });

    // 책상 서랍 유닛 (오른쪽에 추가 서랍장 모형)
    const drawerUnit = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.45, 0.9), woodMat);
    drawerUnit.position.set(0.7, 0.65, 0);
    drawerUnit.castShadow = true;
    desk.add(drawerUnit);

    desk.position.set(0, 0, 0);
    this.scene.add(desk);

    // 2. 의자 (책상 뒤 X=0, Z=0.9 부근)
    const chair = new THREE.Group();
    const chairSeat = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.06, 0.5), woodMat);
    chairSeat.position.y = 0.55;
    chairSeat.castShadow = true;
    chair.add(chairSeat);

    const chairBack = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.6, 0.06), woodMat);
    chairBack.position.set(0, 0.85, 0.22);
    chairBack.castShadow = true;
    chair.add(chairBack);

    [[-0.23, -0.2], [0.23, -0.2], [-0.23, 0.2], [0.23, 0.2]].forEach(([cx, cz]) => {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.55, 0.05), woodMat);
      leg.position.set(cx, 0.275, cz);
      leg.castShadow = true;
      chair.add(leg);
    });
    chair.position.set(-0.1, 0, 1.05);
    chair.rotation.y = -0.15;
    this.scene.add(chair);
    this.chairRef = chair; // 앞치마 배치를 위해 참조

    // 3. 책장 (뒷벽 Z = -3.7 부근)
    const bookshelf = new THREE.Group();
    const outerFrame = new THREE.Mesh(new THREE.BoxGeometry(1.8, 2.5, 0.38), woodMat);
    outerFrame.position.set(0, 1.25, 0);
    outerFrame.castShadow = true;
    outerFrame.receiveShadow = true;
    bookshelf.add(outerFrame);

    // 책장 선반 가로 파임 데코레이션용 검은 판
    for (let sy = 0.4; sy <= 2.2; sy += 0.5) {
      const shelfLine = new THREE.Mesh(new THREE.BoxGeometry(1.68, 0.03, 0.32), new THREE.MeshStandardMaterial({ color: 0x050505 }));
      shelfLine.position.set(0, sy, 0.04);
      bookshelf.add(shelfLine);
    }
    bookshelf.position.set(-1.8, 0, -3.75);
    this.scene.add(bookshelf);
    this.bookshelfRef = bookshelf; // 금고 배치를 위해 참조

    // 4. 벽난로 (좌측벽에 인접 X = -3.7 부근)
    const fireplace = new THREE.Group();
    const fireplaceBase = new THREE.Mesh(new THREE.BoxGeometry(0.6, 1.3, 1.8), metalMat);
    fireplaceBase.position.set(0, 0.65, 0);
    fireplaceBase.castShadow = true;
    fireplace.add(fireplaceBase);

    // 벽난로 화구 (속이 뚫린 연출을 위해 조금 어두운 파츠)
    const firePit = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.6, 1.0), new THREE.MeshStandardMaterial({ color: 0x030303, roughness: 1.0 }));
    firePit.position.set(0.06, 0.4, 0);
    fireplace.add(firePit);

    fireplace.position.set(-3.7, 0, 0.8);
    fireplace.rotation.y = Math.PI / 2;
    this.scene.add(fireplace);
  }

  /* ── 클릭 가능한 단서 오브젝트 8개 빌드 ── */
  _buildClues() {
    const goldMat = new THREE.MeshStandardMaterial({ color: 0xe8c87a, metalness: 0.9, roughness: 0.1 });
    const paperMat = new THREE.MeshStandardMaterial({ color: 0xeae6d8, roughness: 1.0 });

    // ── 단서 1. 위스키 잔 (whiskey) ──
    const whiskey = new THREE.Group();
    whiskey.userData.clueId = 'whiskey';
    
    const glass = new THREE.Mesh(
      new THREE.CylinderGeometry(0.04, 0.04, 0.1, 10),
      new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0.4, roughness: 0.1 })
    );
    glass.castShadow = true;
    whiskey.add(glass);
    
    const liquor = new THREE.Mesh(
      new THREE.CylinderGeometry(0.038, 0.038, 0.04, 10),
      new THREE.MeshStandardMaterial({ color: 0x8a4f10, roughness: 0.2 })
    );
    liquor.position.y = -0.025;
    whiskey.add(liquor);

    whiskey.position.set(-0.6, 1.04, 0.1);
    this.scene.add(whiskey);
    this.clueMeshes['whiskey'] = whiskey;


    // ── 단서 2. 독극물 구매 영수증 (receipt) ──
    const receipt = new THREE.Group();
    receipt.userData.clueId = 'receipt';

    const slip = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.002, 0.18), paperMat);
    slip.castShadow = true;
    receipt.add(slip);

    const txt1 = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.001, 0.006), new THREE.MeshStandardMaterial({ color: 0x444444 }));
    txt1.position.set(0, 0.002, 0.04);
    receipt.add(txt1);

    const txt2 = txt1.clone();
    txt2.position.set(-0.01, 0.002, 0.01);
    receipt.add(txt2);

    // 책상 위 서랍 상판 구석에 약간 숨김 배치
    receipt.position.set(0.65, 0.89, 0.2);
    receipt.rotation.y = 0.8;
    this.scene.add(receipt);
    this.clueMeshes['receipt'] = receipt;


    // ── 단서 3. 보조 열쇠 (spare_key) ──
    const spareKey = new THREE.Group();
    spareKey.userData.clueId = 'spare_key';

    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.02, 0.006, 4, 10), goldMat);
    ring.rotation.x = Math.PI / 2;
    spareKey.add(ring);

    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.005, 0.09, 8), goldMat);
    shaft.position.y = -0.055;
    shaft.rotation.z = Math.PI / 2;
    spareKey.add(shaft);

    const tooth = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.005, 0.015), goldMat);
    tooth.position.set(0.045, -0.005, 0.01);
    spareKey.add(tooth);

    spareKey.position.set(0.7, 0.89, -0.2);
    spareKey.rotation.set(0.1, 0.5, 0);
    this.scene.add(spareKey);
    this.clueMeshes['spare_key'] = spareKey;


    // ── 단서 4. 출입 기록부 (schedule) ──
    const schedule = new THREE.Group();
    schedule.userData.clueId = 'schedule';

    const sheet = new THREE.Mesh(new THREE.BoxGeometry(0.005, 0.45, 0.32), paperMat);
    sheet.castShadow = true;
    schedule.add(sheet);

    const pin = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.005, 0.02, 8), goldMat);
    pin.position.set(0.005, 0.21, 0);
    pin.rotation.z = Math.PI / 2;
    schedule.add(pin);

    // 우측 벽에 부착
    schedule.position.set(3.96, 2.3, -1.0);
    this.scene.add(schedule);
    this.clueMeshes['schedule'] = schedule;


    // ── 단서 5. 엘레나의 메모장 (notepad) ──
    const notepad = new THREE.Group();
    notepad.userData.clueId = 'notepad';

    const cover = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.04, 0.3), new THREE.MeshStandardMaterial({ color: 0x331a1a, roughness: 0.9 }));
    cover.castShadow = true;
    notepad.add(cover);

    const pages = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.036, 0.28), paperMat);
    pages.position.set(0.002, 0.002, 0);
    notepad.add(pages);

    // 책상 위 중앙에 배치
    notepad.position.set(-0.35, 1.0, -0.2);
    notepad.rotation.y = -0.25;
    this.scene.add(notepad);
    this.clueMeshes['notepad'] = notepad;


    // ── 단서 6. 협박 편지 (letter) ──
    const letter = new THREE.Group();
    letter.userData.clueId = 'letter';

    const paperBox = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.004, 0.28), paperMat);
    paperBox.castShadow = true;
    letter.add(paperBox);

    const line = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.001, 0.01), new THREE.MeshStandardMaterial({ color: 0x222222 }));
    line.position.set(0, 0.003, 0.03);
    letter.add(line);
    
    const line2 = line.clone();
    line2.position.set(-0.02, 0.003, 0.0);
    letter.add(line2);

    letter.position.set(0.1, 1.0, 0.25);
    letter.rotation.y = 0.45;
    this.scene.add(letter);
    this.clueMeshes['letter'] = letter;


    // ── 단서 7. 명함 (card) ──
    const card = new THREE.Group();
    card.userData.clueId = 'card';

    const cardBox = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.002, 0.05), new THREE.MeshStandardMaterial({ color: 0x111116, metalness: 0.3, roughness: 0.8 }));
    cardBox.castShadow = true;
    card.add(cardBox);

    const cardLogo = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.003, 0.015), goldMat);
    cardLogo.position.set(-0.02, 0.001, 0);
    card.add(cardLogo);

    // 책상 위 위스키 잔 옆에 배치
    card.position.set(-0.7, 1.0, 0.3);
    card.rotation.y = 1.1;
    this.scene.add(card);
    this.clueMeshes['card'] = card;


    // ── 단서 8. 찢어진 사진 (photo) ──
    const trashArea = new THREE.Group();
    trashArea.userData.clueId = 'photo';

    const bin = new THREE.Mesh(
      new THREE.CylinderGeometry(0.16, 0.12, 0.38, 12, 1, true),
      new THREE.MeshStandardMaterial({ color: 0x333338, metalness: 0.6, roughness: 0.7, side: THREE.DoubleSide })
    );
    bin.castShadow = true;
    trashArea.add(bin);

    const photoPiece = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.005, 0.1), paperMat);
    photoPiece.position.set(0.04, 0.17, -0.06);
    photoPiece.rotation.set(0.6, -0.2, 0.3);
    trashArea.add(photoPiece);

    trashArea.position.set(1.1, 0.19, 0.6);
    this.scene.add(trashArea);
    this.clueMeshes['photo'] = trashArea;


    // ── 단서 9. 이혼 서류 (divorce) ──
    const divorce = new THREE.Group();
    divorce.userData.clueId = 'divorce';

    const folder = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.01, 0.34), new THREE.MeshStandardMaterial({ color: 0x4a3a2a, roughness: 0.9 }));
    folder.castShadow = true;
    divorce.add(folder);

    const documentSheet = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.012, 0.32), paperMat);
    documentSheet.position.y = 0.002;
    divorce.add(documentSheet);

    // 책상 위 서류 더미 위에 대각선 배치
    divorce.position.set(-0.3, 1.0, 0.35);
    divorce.rotation.y = -0.6;
    this.scene.add(divorce);
    this.clueMeshes['divorce'] = divorce;


    // ── 단서 10. 요리사 앞치마 (apron) ──
    const apron = new THREE.Group();
    apron.userData.clueId = 'apron';

    const fabricColor = 0x5a5448;
    const fabricMat = new THREE.MeshStandardMaterial({ color: fabricColor, roughness: 0.95 });

    const mainDrape = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.52, 0.03), fabricMat);
    mainDrape.position.set(0, 0.82, 0.26);
    apron.add(mainDrape);

    const strap = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.55, 0.04), fabricMat);
    strap.position.set(-0.2, 0.85, 0.23);
    apron.add(strap);
    
    const strap2 = strap.clone();
    strap2.position.x = 0.2;
    apron.add(strap2);

    apron.position.copy(this.chairRef.position);
    apron.rotation.copy(this.chairRef.rotation);
    this.scene.add(apron);
    this.clueMeshes['apron'] = apron;


    // ── 단서 11. 잠긴 창문 (window) ──
    const windowGroup = new THREE.Group();
    windowGroup.userData.clueId = 'window';

    const frameMat = new THREE.MeshStandardMaterial({ color: 0x0f0c08, roughness: 0.9 });
    const glassMat = new THREE.MeshStandardMaterial({ color: 0x667788, transparent: true, opacity: 0.15, roughness: 0.05 });

    const wFrame = new THREE.Mesh(new THREE.BoxGeometry(0.08, 2.0, 1.8), frameMat);
    wFrame.position.set(0, 0, 0);
    windowGroup.add(wFrame);

    const gridV = new THREE.Mesh(new THREE.BoxGeometry(0.09, 2.0, 0.04), frameMat);
    gridV.position.set(0.002, 0, 0);
    windowGroup.add(gridV);

    const gridH = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.04, 1.8), frameMat);
    gridH.position.set(0.002, 0, 0);
    windowGroup.add(gridH);

    const wGlass = new THREE.Mesh(new THREE.PlaneGeometry(1.72, 1.92), glassMat);
    wGlass.rotation.y = Math.PI / 2;
    wGlass.position.set(0.001, 0, 0);
    windowGroup.add(wGlass);

    windowGroup.position.set(3.96, 2.0, 1.2);
    this.scene.add(windowGroup);
    this.clueMeshes['window'] = windowGroup;


    // ── 단서 12. 빈 독극물 용기 (vial) ──
    const vial = new THREE.Group();
    vial.userData.clueId = 'vial';

    // 미니 약병 조형물
    const vialBody = new THREE.Mesh(
      new THREE.CylinderGeometry(0.025, 0.025, 0.08, 8),
      new THREE.MeshStandardMaterial({ color: 0x8a9aa5, transparent: true, opacity: 0.4, roughness: 0.2 })
    );
    vialBody.castShadow = true;
    vial.add(vialBody);

    const vialCap = new THREE.Mesh(
      new THREE.CylinderGeometry(0.015, 0.015, 0.02, 8),
      new THREE.MeshStandardMaterial({ color: 0x050505, roughness: 0.8 })
    );
    vialCap.position.y = 0.048;
    vial.add(vialCap);

    // 벽난로 화로 구석에 살짝 떨어져 있음
    vial.position.set(-3.4, 0.12, 1.2);
    vial.rotation.set(1.4, 0.2, -0.6);
    this.scene.add(vial);
    this.clueMeshes['vial'] = vial;
  }

  /* ── 조명 및 블라인드 그림자 광선 연출 ── */
  _buildLighting() {
    // 1. 앰비언트 라이트 (기본 명암 보정)
    const ambient = new THREE.AmbientLight(0x0e0d16, 0.5);
    this.scene.add(ambient);

    // 2. 펜듈럼 천장 전구 피벗
    this.bulbPivot = new THREE.Group();
    this.bulbPivot.position.set(0, 4.0, 0.0);
    this.scene.add(this.bulbPivot);

    // 전선
    const wire = new THREE.Mesh(
      new THREE.CylinderGeometry(0.008, 0.008, 1.0, 6),
      new THREE.MeshStandardMaterial({ color: 0x111010 })
    );
    wire.position.y = -0.5;
    this.bulbPivot.add(wire);

    // 전구 메시
    const bulbMat = new THREE.MeshStandardMaterial({
      color: 0xfff3d0,
      emissive: 0xffdd99,
      emissiveIntensity: 2.2,
      roughness: 0.1
    });
    this.bulbMesh = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 8), bulbMat);
    this.bulbMesh.position.y = -1.0;
    this.bulbPivot.add(this.bulbMesh);

    // 전구 포인트 라이트 (그림자 생성)
    this.bulbLight = new THREE.PointLight(0xfff3d0, 1.8, 12, 1.5);
    this.bulbLight.position.copy(this.bulbMesh.position);
    this.bulbLight.castShadow = true;
    this.bulbLight.shadow.mapSize.set(512, 512);
    this.bulbPivot.add(this.bulbLight);

    // 3. 블라인드 광선 (창문 위치에서 방 중앙을 대각선 아래로 내리쬐는 스포트라이트)
    const windowSpot = new THREE.SpotLight(0xa5c9f5, 12.0, 18, Math.PI / 4, 0.4, 1);
    windowSpot.position.set(3.8, 2.6, 1.2);
    windowSpot.target.position.set(0, 0.4, 0.2);
    windowSpot.castShadow = true;
    windowSpot.shadow.mapSize.set(1024, 1024);
    windowSpot.shadow.bias = -0.001;
    this.scene.add(windowSpot);
    this.scene.add(windowSpot.target);

    // 벽난로 화로 은은한 주황 빛
    const fireLight = new THREE.PointLight(0xff4500, 1.5, 4, 1);
    fireLight.position.set(-3.3, 0.4, 0.8);
    this.scene.add(fireLight);
  }

  /* ── 서재 공기 중 먼지 파티클 생성 ── */
  _buildParticles() {
    const COUNT = 120;
    const positions = new Float32Array(COUNT * 3);
    this.particleVelocities = [];

    for (let i = 0; i < COUNT; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 6;
      positions[i * 3 + 1] = Math.random() * 3.6;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 6;
      
      this.particleVelocities.push({
        x: (Math.random() - 0.5) * 0.002,
        y: Math.random() * 0.0015 + 0.0005,
        z: (Math.random() - 0.5) * 0.002
      });
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    const mat = new THREE.PointsMaterial({
      color: 0xe8c87a,
      size: 0.025,
      transparent: true,
      opacity: 0.35,
      sizeAttenuation: true,
      depthWrite: false
    });

    this.particles = new THREE.Points(geo, mat);
    this.scene.add(this.particles);
  }

  /* ── 씬 정리 ── */
  destroy() {
    this.isAnimating = false;
    if (this._resizeObserver) this._resizeObserver.disconnect();
    this.renderer.dispose();
  }

  /* ── 프레임 렌더 및 물리 애니메이션 루프 ── */
  _animate() {
    if (this.isAnimating === false) return;
    requestAnimationFrame(() => this._animate());

    const delta = this.clock.getDelta();
    const t = this.clock.getElapsedTime();

    // 1. 천장 백열등 전구 흔들림 (펜듈럼 애니메이션)
    if (this.bulbPivot) {
      this.bulbPivot.rotation.z = Math.sin(t * 0.45) * 0.05;
      this.bulbPivot.rotation.x = Math.cos(t * 0.35) * 0.03;
    }

    // 2. 조명 지직거리는 플리커 타이머
    if (this.bulbLight && this.bulbMesh) {
      this.flickerTimer += delta;
      if (this.flickerTimer > this.flickerInterval) {
        this.flickerTimer = 0;
        this.flickerInterval = 2 + Math.random() * 5;
        this._doFlicker();
      }
    }

    // 3. 먼지 파티클 둥둥 떠다니는 모션
    if (this.particles) {
      const pos = this.particles.geometry.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        pos.setX(i, pos.getX(i) + this.particleVelocities[i].x);
        pos.setY(i, pos.getY(i) + this.particleVelocities[i].y);
        pos.setZ(i, pos.getZ(i) + this.particleVelocities[i].z);

        // 천장 높이 이상 올라가면 바닥으로 리젠
        if (pos.getY(i) > 3.8) {
          pos.setY(i, 0.05);
          pos.setX(i, (Math.random() - 0.5) * 6);
          pos.setZ(i, (Math.random() - 0.5) * 6);
        }
      }
      pos.needsUpdate = true;
    }

    // 4. 8개 단서 오브젝트의 은은한 자체 호흡/회전 모션
    Object.values(this.clueMeshes).forEach((mesh, idx) => {
      // 획득 시 사라지지 않고 은은히 회전함 (수집 편의 유도)
      if (mesh.userData.clueId === 'whiskey' || mesh.userData.clueId === 'spare_key') {
        mesh.rotation.y = (t * 0.3) + idx;
      }
    });

    this.renderer.render(this.scene, this.camera);
  }

  /* ── 씬 라이트 깜빡거림 연출 ── */
  _doFlicker() {
    if (!this.bulbLight || !this.bulbMesh) return;
    const orig = this.bulbLight.intensity;
    const steps = [0.2, 1.2, 0.1, 1.0, 0.3, 1.0];
    let s = 0;
    const run = () => {
      if (s >= steps.length) {
        this.bulbLight.intensity = 1.8;
        this.bulbMesh.material.emissiveIntensity = 2.2;
        return;
      }
      this.bulbLight.intensity = 1.8 * steps[s];
      this.bulbMesh.material.emissiveIntensity = 2.2 * steps[s];
      s++;
      setTimeout(run, 50 + Math.random() * 50);
    };
    run();
  }
}
