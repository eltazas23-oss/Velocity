import bpy
import math
import bmesh
from mathutils import Vector, noise

# Reset
bpy.ops.wm.read_factory_settings(use_empty=True)

INNER_RADIUS = 370.0
OUTER_RADIUS = 840.0
RADIAL_SEGMENTS = 256
HEIGHT_SEGMENTS = 32

bm = bmesh.new()

def alpine_elevation(theta, radius):
    t = (radius - INNER_RADIUS) / (OUTER_RADIUS - INNER_RADIUS)
    t = max(0.0, min(1.0, t))
    
    radial_profile = math.pow(t, 1.42)
    
    # 360 continuous harmonics: high alpine massifs, cols, ridges
    m1 = math.sin(theta * 2.0 + 0.8) * 58.0 + math.cos(theta * 3.0 - 0.4) * 44.0
    m2 = math.sin(theta * 5.0 + 2.1) * 28.0 + math.cos(theta * 7.0 + 1.2) * 18.0
    m3 = math.sin(theta * 11.0 - 1.5) * 12.0 + math.cos(theta * 17.0 + 0.3) * 6.0
    
    macro_height = 85.0 + m1 + m2 + m3
    macro_height = max(18.0, macro_height)
    
    x = math.cos(theta) * radius
    z = math.sin(theta) * radius
    
    # Perlin fractal noise simulation for erosion
    p1 = Vector((x * 0.0032, z * 0.0032, 0.0))
    n1 = noise.fractal(p1, 2.0, 4, 1)
    
    # Sharp arêtes and ridgeline modulation
    ridge = 1.0 - abs(n1)
    ridge_boost = math.pow(ridge, 1.5) * 32.0
    
    p2 = Vector((x * 0.007, z * 0.007, 0.5))
    n2 = noise.turbulence(p2, 3, 0) * 14.0
    
    h = (macro_height + ridge_boost + n2) * radial_profile
    return max(0.0, h)

# Vertices grid
grid_verts = []
for j in range(HEIGHT_SEGMENTS + 1):
    row = []
    t = j / float(HEIGHT_SEGMENTS)
    r = INNER_RADIUS + (OUTER_RADIUS - INNER_RADIUS) * t
    for i in range(RADIAL_SEGMENTS):
        theta = (i / float(RADIAL_SEGMENTS)) * math.pi * 2.0
        x = math.cos(theta) * r
        z = math.sin(theta) * r
        y = alpine_elevation(theta, r)
        v = bm.verts.new((x, y, z))
        row.append(v)
    grid_verts.append(row)

# Faces
for j in range(HEIGHT_SEGMENTS):
    for i in range(RADIAL_SEGMENTS):
        next_i = (i + 1) % RADIAL_SEGMENTS
        v0 = grid_verts[j][i]
        v1 = grid_verts[j][next_i]
        v2 = grid_verts[j + 1][next_i]
        v3 = grid_verts[j + 1][i]
        try:
            bm.faces.new((v0, v1, v2, v3))
        except ValueError:
            pass

bm.verts.ensure_lookup_table()
bm.faces.ensure_lookup_table()

# Cylindrical equirectangular UV mapping
uv_layer = bm.loops.layers.uv.new("UVMap")
for j in range(HEIGHT_SEGMENTS):
    t_bottom = j / float(HEIGHT_SEGMENTS)
    t_top = (j + 1) / float(HEIGHT_SEGMENTS)
    for i in range(RADIAL_SEGMENTS):
        next_i = i + 1
        u_left = i / float(RADIAL_SEGMENTS)
        u_right = next_i / float(RADIAL_SEGMENTS)
        face = bm.faces[j * RADIAL_SEGMENTS + i]
        for loop in face.loops:
            v = loop.vert
            if v == grid_verts[j][i]:
                loop[uv_layer].uv = (u_left, t_bottom)
            elif v == grid_verts[j][(i + 1) % RADIAL_SEGMENTS]:
                loop[uv_layer].uv = (u_right, t_bottom)
            elif v == grid_verts[j + 1][(i + 1) % RADIAL_SEGMENTS]:
                loop[uv_layer].uv = (u_right, t_top)
            elif v == grid_verts[j + 1][i]:
                loop[uv_layer].uv = (u_left, t_top)

for f in bm.faces:
    f.smooth = True

mesh = bpy.data.meshes.new("MountainMassifMesh")
bm.to_mesh(mesh)
bm.free()

obj = bpy.data.objects.new("DistantMountainMassif", mesh)
bpy.context.collection.objects.link(obj)

bpy.context.view_layer.objects.active = obj
obj.select_set(True)
bpy.ops.object.shade_smooth()

output_path = "/app/applet/public/models/hyperrealistic_mountains.glb"
print(f"Exporting to {output_path}...")
bpy.ops.export_scene.gltf(
    filepath=output_path,
    export_format='GLB',
    use_selection=True,
    export_normals=True,
    export_tangents=False,
    export_materials='NONE',
    export_colors=False,
    export_yup=True
)
print("SUCCESS_EXPORT_GLB")
