# Use an official Python runtime
FROM python:3.10-slim

# Create a non-root user
RUN useradd -m -u 1000 user
USER user
ENV PATH="/home/user/.local/bin:$PATH"

# Set the working directory
WORKDIR /app

# Copy requirements and install
COPY --chown=user requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy the rest of your backend code
COPY --chown=user . .

# Expose the port Hugging Face requires
EXPOSE 7860

# Run the FastAPI application (assuming your app is in main.py)
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "7860"]