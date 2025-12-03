# --- 커스텀 설정 (Folly 및 기타 패치) ---
# Folly 및 C++20 설정을 모든 타겟에 직접 주입
begin
  folly_definitions = [
    'FOLLY_NO_CONFIG=1',
    'FOLLY_HAS_COROUTINES=0',
    'FOLLY_USE_COROUTINES=0',
    'FOLLY_USE_CPP_COROUTINES=0'
  ]

  apply_folly_settings = lambda do |config|
    next unless config.respond_to?(:build_settings)

    config.build_settings['CLANG_CXX_LANGUAGE_STANDARD'] = 'gnu++20'
    config.build_settings['CLANG_CXX_LIBRARY'] = 'libc++'

    defs = config.build_settings['GCC_PREPROCESSOR_DEFINITIONS']
    defs_array = Array(defs).flat_map { |d| d.to_s.split(' ') }
    defs_array = ['$(inherited)'] if defs_array.empty?
    defs_array.concat(folly_definitions)
    config.build_settings['GCC_PREPROCESSOR_DEFINITIONS'] = defs_array.uniq

    cppflags = Array(config.build_settings['OTHER_CPLUSPLUSFLAGS'])
    cppflags << '$(inherited)' if cppflags.empty?
    cppflags << '-std=gnu++20'
    cppflags.concat(%w[-UFOLLY_HAS_COROUTINES -DFOLLY_HAS_COROUTINES=0 -DFOLLY_USE_COROUTINES=0 -DFOLLY_USE_CPP_COROUTINES=0])
    config.build_settings['OTHER_CPLUSPLUSFLAGS'] = cppflags.uniq

    header_paths = Array(config.build_settings['HEADER_SEARCH_PATHS'])
    header_paths << '$(inherited)' if header_paths.empty?
    header_paths << '$(PROJECT_DIR)/../vendor/folly'
    header_paths << '$(PODS_ROOT)/../../vendor/folly'
    config.build_settings['HEADER_SEARCH_PATHS'] = header_paths.uniq
  end

  installer.pods_project.targets.each do |target|
    target.build_configurations.each(&apply_folly_settings)
  end

  installer.aggregate_targets.each do |aggregate_target|
    aggregate_target.user_targets.each do |user_target|
      user_target.build_configurations.each(&apply_folly_settings)
    end
  end

  if installer.respond_to?(:user_project)
    installer.user_project.targets.each do |target|
      next unless target.respond_to?(:build_configurations)
      target.build_configurations.each(&apply_folly_settings)
    end
  end

  Pod::UI.puts " Folly 설정을 모든 타겟에 직접 적용했습니다."
rescue => e
  Pod::UI.puts " Folly 설정 주입 실패: " + e.message.to_s
end

