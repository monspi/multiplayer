import os
from PIL import Image

def slice_image(image_path, output_dir, tile_width, tile_height):
    """
    将图片切割成指定大小的小图片
    """
    # 打开图片
    img = Image.open(image_path)
    img_width, img_height = img.size
    
    # 确保输出目录存在
    os.makedirs(output_dir, exist_ok=True)
    
    # 计算可以切割的行列数
    cols = img_width // tile_width
    rows = img_height // tile_height
    
    # 获取原文件名（不包含扩展名）
    base_name = os.path.splitext(os.path.basename(image_path))[0]
    
    tile_count = 0
    
    # 切割图片
    for row in range(rows):
        for col in range(cols):
            # 计算当前tile的坐标
            left = col * tile_width
            top = row * tile_height
            right = left + tile_width
            bottom = top + tile_height
            
            # 切割图片
            tile = img.crop((left, top, right, bottom))
            
            # 保存tile
            tile_name = f"{base_name}_{row}_{col}.png"
            tile_path = os.path.join(output_dir, tile_name)
            tile.save(tile_path)
            
            tile_count += 1
            
    print(f"成功切割 {image_path}")
    print(f"输出 {tile_count} 个 {tile_width}x{tile_height} 的图片到 {output_dir}")
    print(f"原图尺寸: {img_width}x{img_height}")
    print(f"切割网格: {cols} 列 x {rows} 行")
    print("-" * 50)

def slice_image_selective(image_path, output_dir, tile_width, tile_height, selected_positions):
    """
    将图片切割成指定大小的小图片，但只保留指定位置的切片
    selected_positions: 要保留的位置列表，格式为 [(row, col), ...]
    """
    # 打开图片
    img = Image.open(image_path)
    img_width, img_height = img.size
    
    # 确保输出目录存在
    os.makedirs(output_dir, exist_ok=True)
    
    # 计算可以切割的行列数
    cols = img_width // tile_width
    rows = img_height // tile_height
    
    # 获取原文件名（不包含扩展名）
    base_name = os.path.splitext(os.path.basename(image_path))[0]
    
    tile_count = 0
    
    # 只切割指定位置的图片
    for row, col in selected_positions:
        if row < rows and col < cols:
            # 计算当前tile的坐标
            left = col * tile_width
            top = row * tile_height
            right = left + tile_width
            bottom = top + tile_height
            
            # 切割图片
            tile = img.crop((left, top, right, bottom))
            
            # 保存tile
            tile_name = f"{base_name}_{row}_{col}.png"
            tile_path = os.path.join(output_dir, tile_name)
            tile.save(tile_path)
            
            tile_count += 1
            
    print(f"成功切割 {image_path}")
    print(f"输出 {tile_count} 个选定的 {tile_width}x{tile_height} 图片到 {output_dir}")
    print(f"原图尺寸: {img_width}x{img_height}")
    print(f"切割网格: {cols} 列 x {rows} 行")
    print(f"选定位置: {selected_positions}")
    print("-" * 50)

def main():
    # 设置路径
    assets_dir = "assets"
    
    # 要保留的位置：0_1, 0_3, 0_5, 0_7
    selected_positions = [(0, 1), (0, 3), (0, 5), (0, 7)]
    
    # 要处理的图片列表
    character_images = [
        "Actor1.png", "Actor2.png", "Actor3.png", 
        "Evil.png", 
        "People1.png", "People2.png", "People3.png", "People4.png",
        "Vehicle.png"
    ]
    
    # 处理角色图片
    for image_name in character_images:
        image_path = os.path.join(assets_dir, image_name)
        base_name = os.path.splitext(image_name)[0]
        output_dir = os.path.join(assets_dir, "characters", base_name)
        
        if os.path.exists(image_path):
            slice_image_selective(image_path, output_dir, 48, 48, selected_positions)
        else:
            print(f"找不到文件: {image_path}")
    
    # 切割background.png为48x48的图片
    background_path = os.path.join(assets_dir, "background.png")
    background_output = os.path.join(assets_dir, "background")
    
    if os.path.exists(background_path):
        slice_image(background_path, background_output, 48, 48)
    else:
        print(f"找不到文件: {background_path}")
    
    # 切割sprites.png为48x48的图片  
    sprites_path = os.path.join(assets_dir, "sprites.png")
    sprites_output = os.path.join(assets_dir, "sprite")
    
    if os.path.exists(sprites_path):
        slice_image(sprites_path, sprites_output, 48, 48)
    else:
        print(f"找不到文件: {sprites_path}")

if __name__ == "__main__":
    main()
