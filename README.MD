## Scroll Boy

滚屏动画

## 使用

### 自定义配置参数


```html
<div class="foo"> Foo </div>
<div class="foo" id="chocolate"> Chip </div>
```
```js
var fooReveal = {
  delay    : 200,
  distance : '90px',
  easing   : 'ease-in-out',
  rotate   : { z: 10 },
  scale    : 1.1
};

window.sr = ScrollBoy();
sr.reveal('.foo', fooReveal);
sr.reveal('#chocolate', { delay: 500, scale: 0.9 });
```