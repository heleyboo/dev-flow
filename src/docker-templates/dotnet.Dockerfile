FROM mcr.microsoft.com/dotnet/sdk:{{version}}

WORKDIR /app

COPY *.csproj ./
RUN dotnet restore

COPY . .

EXPOSE {{port}}

CMD ["dotnet", "watch", "run"]
