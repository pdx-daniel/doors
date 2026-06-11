PLANETILER_DATA := data/planetiler
PMTILES_DEST := apps/mobile/public/basemaps/basemap.pmtiles
PLANETILER_RAM ?= 4g
# Geofabrik extract name (e.g. oregon, monaco, massachusetts). Override: make basemap-refresh PLANETILER_AREA=monaco
PLANETILER_AREA ?= oregon

.PHONY: basemap-refresh
basemap-refresh:
	mkdir -p $(PLANETILER_DATA) apps/mobile/public/basemaps
	docker run --rm \
	  -e JAVA_TOOL_OPTIONS="-Xmx$(PLANETILER_RAM)" \
	  -v "$(CURDIR)/$(PLANETILER_DATA):/data" \
	  ghcr.io/onthegomap/planetiler:latest \
	  --download \
	  --area=$(PLANETILER_AREA) \
	  --output=/data/basemap.pmtiles
	cp $(PLANETILER_DATA)/basemap.pmtiles $(PMTILES_DEST)
