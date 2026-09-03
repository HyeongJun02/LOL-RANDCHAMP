/* CRA가 모든 테스트 앞에 자동으로 돌린다.

   jsdom에는 ResizeObserver가 없다. 헤더 높이 실측, 룰렛 폭 실측 등
   여러 곳에서 쓰므로 파일마다 스텁을 두지 않고 여기서 한 번만 채운다. */
if (typeof global.ResizeObserver === 'undefined') {
  global.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}
