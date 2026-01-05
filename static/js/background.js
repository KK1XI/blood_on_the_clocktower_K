// WebGL 背景渲染器 - 2.5D 光照效果
document.addEventListener('DOMContentLoaded', () => {
    const canvas = document.getElementById('bg-canvas');
    if (!canvas) return;

    const gl = canvas.getContext('webgl');
    if (!gl) {
        console.warn('WebGL 不支持，回退到 CSS 背景。');
        return;
    }

    // 调整画布大小以铺满全屏
    function resize() {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        gl.viewport(0, 0, canvas.width, canvas.height);
    }
    window.addEventListener('resize', resize);
    resize();

    // Shader 着色器源码
    const vsSource = `
        attribute vec2 a_position;
        varying vec2 v_texCoord;
        void main() {
            // 将坐标从 -1->1 转换为 0->1 用于纹理坐标
            v_texCoord = a_position * 0.5 + 0.5;
            // 如有需要翻转 Y 轴，但通常 WebGL 中 0,0 在左下角
            // 我们需要全屏四边形
            gl_Position = vec4(a_position, 0.0, 1.0);
        }
    `;

    const fsSource = `
        precision mediump float;
        
        uniform sampler2D u_colorMap;
        uniform sampler2D u_normalMap;
        uniform vec2 u_resolution;
        uniform vec2 u_mouse;
        
        varying vec2 v_texCoord;

        void main() {
            // 修正 UV 的纵横比以避免拉伸
            vec2 uv = v_texCoord;
            vec2 ratio = vec2(u_resolution.x / u_resolution.y, 1.0);
            
            // 纹理平铺（在屏幕高度方向重复 1.0 次）
            vec2 tiledUV = uv * vec2(1.0 * ratio.x, 1.0);
            
            // 采样纹理
            vec4 color = texture2D(u_colorMap, tiledUV);
            vec4 normalSample = texture2D(u_normalMap, tiledUV);
            
            // 将法线数据从 [0,1] 解包为 [-1,1]
            vec3 normal = normalize(normalSample.rgb * 2.0 - 1.0);
            
            // 计算光照方向
            // 鼠标在屏幕像素坐标系中，我们将其归一化
            vec2 mouseNorm = u_mouse / u_resolution;
            // 反转鼠标 Y 轴，因为 WebGL Y 轴向上
            mouseNorm.y = 1.0 - mouseNorm.y;
            
            // UV 空间中的光源位置（归一化 0-1）
            vec3 lightPos = vec3(mouseNorm, 0.2); // 0.2 是光源高度 (Z)
            
            // UV 空间中的当前像素位置
            vec3 pixelPos = vec3(uv, 0.0);
            
            // 从像素指向光源的向量
            vec3 lightDir = normalize(lightPos - pixelPos);
            
            // 环境光（基础亮度）
            float ambient = 0.5;
            
            // 漫反射光（兰伯特余弦定律 / 点积）
            // 对于 2D 效果我们主要关注法线 XY 分量的影响，但正确的 Z 分量也有帮助
            float diffuse = max(dot(normal, lightDir), 0.0);
            
            // 距离衰减（光线随距离减弱）
            float dist = distance(vec2(mouseNorm.x * ratio.x, mouseNorm.y), vec2(uv.x * ratio.x, uv.y));
            // 光照半径
            float attenuation = 1.0 / (1.0 + dist * dist * 2.0);
            
            // 最终光照强度
            vec3 light = vec3(ambient + diffuse * attenuation * 2.0); // 2.0 是光照功率
            
            // 暗角效果（压暗角落）
            float vignette = 1.0 - length((uv - 0.5) * vec2(1.0, u_resolution.y/u_resolution.x)) * 0.5;
            vignette = clamp(vignette, 0.0, 1.0);
            
            // 组合最终颜色
            gl_FragColor = vec4(color.rgb * light * vignette, 1.0);
        }
    `;

    // 编译 Shader
    function createShader(gl, type, source) {
        const shader = gl.createShader(type);
        gl.shaderSource(shader, source);
        gl.compileShader(shader);
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
            console.error('Shader 编译错误:', gl.getShaderInfoLog(shader));
            gl.deleteShader(shader);
            return null;
        }
        return shader;
    }

    const vertexShader = createShader(gl, gl.VERTEX_SHADER, vsSource);
    const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, fsSource);
    
    const program = gl.createProgram();
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        console.error('Program 链接错误:', gl.getProgramInfoLog(program));
        return;
    }

    // 设置几何体（全屏四边形）
    const positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
        -1.0, -1.0,
         1.0, -1.0,
        -1.0,  1.0,
        -1.0,  1.0,
         1.0, -1.0,
         1.0,  1.0,
    ]), gl.STATIC_DRAW);

    const positionAttributeLocation = gl.getAttribLocation(program, "a_position");
    gl.enableVertexAttribArray(positionAttributeLocation);
    gl.vertexAttribPointer(positionAttributeLocation, 2, gl.FLOAT, false, 0, 0);

    // 加载纹理
    function loadTexture(url, unit) {
        const texture = gl.createTexture();
        gl.activeTexture(gl.TEXTURE0 + unit);
        gl.bindTexture(gl.TEXTURE_2D, texture);
        
        // 加载时的占位像素
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE,
                      new Uint8Array([0, 0, 0, 255]));

        const image = new Image();
        image.onload = function() {
            gl.activeTexture(gl.TEXTURE0 + unit);
            gl.bindTexture(gl.TEXTURE_2D, texture);
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
            
            // 生成 Mipmap 以获得更好的缩放效果
            gl.generateMipmap(gl.TEXTURE_2D);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
        };
        image.src = url;
        return texture;
    }

    loadTexture('/static/images/textures/leather-color.png', 0);
    loadTexture('/static/images/textures/leather-normal.png', 1);

    // 获取 Uniform 变量位置
    const uResolution = gl.getUniformLocation(program, "u_resolution");
    const uMouse = gl.getUniformLocation(program, "u_mouse");
    const uColorMap = gl.getUniformLocation(program, "u_colorMap");
    const uNormalMap = gl.getUniformLocation(program, "u_normalMap");

    // 鼠标追踪
    let mouseX = window.innerWidth / 2;
    let mouseY = window.innerHeight / 2;

    document.addEventListener('mousemove', (e) => {
        mouseX = e.clientX;
        mouseY = e.clientY;
    });

    // 渲染循环
    function render() {
        gl.useProgram(program);

        gl.uniform2f(uResolution, canvas.width, canvas.height);
        gl.uniform2f(uMouse, mouseX, mouseY);
        gl.uniform1i(uColorMap, 0);
        gl.uniform1i(uNormalMap, 1);

        gl.drawArrays(gl.TRIANGLES, 0, 6);
        requestAnimationFrame(render);
    }
    render();
});
