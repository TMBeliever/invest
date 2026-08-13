FROM python:3.11-slim

WORKDIR /app

# 设置环境变量与中国时区
ENV PYTHONUNBUFFERED=1 \
    PYTHONPATH=/app \
    TZ=Asia/Shanghai

RUN ln -snf /usr/share/zoneinfo/$TZ /etc/localtime && echo $TZ > /etc/timezone

# 安装基础依赖
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# 复制依赖包声明并安装
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt -i https://pypi.tuna.tsinghua.edu.cn/simple

# 复制后端所有代码
COPY . .

# 暴露端口
EXPOSE 8000

# 启动 uvicorn 服务
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
